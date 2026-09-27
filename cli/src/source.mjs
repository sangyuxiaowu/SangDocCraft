import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { marked } from 'marked';
import { createDocumentAsset, unpackSangDocument } from '../../src/utils/documentPackage';
import { normalizeDocumentMeta } from '../../src/utils/documentMigrations';
import defaultTheme from '../default-theme.json';

const mediaTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp', '.svg': 'image/svg+xml' };

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function merge(defaults, overrides) {
  if (!isObject(defaults) || !isObject(overrides)) return overrides == null ? defaults : overrides;
  const result = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) result[key] = merge(defaults[key], value);
  return result;
}

async function readOptionalJson(path) {
  if (!path) return {};
  let value;
  try {
    value = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 JSON 文件 ${path}: ${error.message}`);
  }
  if (!isObject(value)) throw new Error(`JSON 文件必须是对象: ${path}`);
  return value;
}

function isRemote(source) {
  return /^(?:https?:|data:|blob:|#)/i.test(source);
}

function assertWithin(directory, path) {
  const difference = relative(directory, path);
  if (difference === '..' || difference.startsWith(`..${sep}`) || isAbsolute(difference)) {
    throw new Error(`图片路径超出允许目录: ${path}`);
  }
}

export async function loadDocument(source, options = {}) {
  const input = resolve(source);
  const entry = await stat(input);
  if (entry.isFile() && extname(input).toLowerCase() === '.sdc') {
    if (options.meta || options.theme || options.images || options.title) throw new Error('.sdc 输入不接受 --title、--meta、--theme 或 --images');
    return unpackSangDocument(new Uint8Array(await readFile(input)));
  }
  const directory = entry.isDirectory() ? input : dirname(input);
  const markdownPath = entry.isDirectory() ? join(input, 'document.md') : input;
  if (extname(markdownPath).toLowerCase() !== '.md') throw new Error('输入须为文件夹、.md 或 .sdc');
  const markdownDirectory = dirname(markdownPath);
  const metadataPath = options.meta || (entry.isDirectory() ? join(directory, 'meta.json') : undefined);
  const themePath = options.theme || (entry.isDirectory() ? join(directory, 'theme.json') : undefined);
  const optionalJson = async (path, required) => {
    if (!path) return {};
    try {
      await stat(path);
      return await readOptionalJson(path);
    } catch (error) {
      if (error.code === 'ENOENT' && !required) return {};
      throw error;
    }
  };
  const [metaOverrides, themeOverrides] = await Promise.all([optionalJson(metadataPath, Boolean(options.meta)), optionalJson(themePath, Boolean(options.theme))]);
  const markdownSource = await readFile(markdownPath, 'utf8');
  const title = options.title || (typeof metaOverrides.title === 'string' ? metaOverrides.title.trim() : '');
  if (!title) throw new Error('请提供 --title 或在 meta.json 中设置非空 title');
  const meta = normalizeDocumentMeta({ ...metaOverrides, title });
  const theme = merge(defaultTheme, themeOverrides);
  const imagesDirectory = resolve(options.images || join(directory, 'images'));
  const assets = new Map();
  const remoteImages = new Map();

  async function collect(source) {
    if (/^https?:\/\//i.test(source)) {
      if (!remoteImages.has(source)) {
        remoteImages.set(source, (async () => {
          try {
            const response = await fetch(source, { signal: AbortSignal.timeout(10000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const url = new URL(source);
            const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
            const mediaType = contentType || mediaTypes[extname(url.pathname).toLowerCase()];
            if (!Object.values(mediaTypes).includes(mediaType)) throw new Error(`不支持的图片类型: ${mediaType || '未知'}`);
            const asset = await createDocumentAsset(new Uint8Array(await response.arrayBuffer()), {
              fileName: decodeURIComponent(basename(url.pathname)) || 'remote-image',
              mediaType,
            });
            assets.set(asset.id, asset);
            return `@images/${asset.id}`;
          } catch (error) {
            console.warn(`网络图片收集失败，保留原地址 ${source}: ${error.message}`);
            return source;
          }
        })());
      }
      return remoteImages.get(source);
    }
    if (isRemote(source)) return source;
    if (source.startsWith('@')) throw new Error(`文件夹/Markdown 输入不支持未打包的图片引用: ${source}`);
    const normalized = source.replaceAll('\\', '/').replace(/^images\//i, '');
    const path = resolve(imagesDirectory, normalized);
    assertWithin(imagesDirectory, path);
    const extension = extname(path).toLowerCase();
    if (!mediaTypes[extension]) throw new Error(`不支持的图片格式: ${source}`);
    let data;
    try {
      data = await readFile(path);
    } catch (error) {
      throw new Error(`无法读取图片 ${source}: ${error.message}`);
    }
    const asset = await createDocumentAsset(new Uint8Array(data), { fileName: basename(path), mediaType: mediaTypes[extension] });
    assets.set(asset.id, asset);
    return `@images/${asset.id}`;
  }

  const replacements = [];
  const codeRanges = [];
  const findCodeRanges = (tokens, text, offset) => {
    let cursor = 0;
    for (const token of tokens) {
      const start = text.indexOf(token.raw, cursor);
      if (start < 0) continue;
      const absoluteStart = offset + start;
      if (token.type === 'code' || token.type === 'codespan') {
        codeRanges.push([absoluteStart, absoluteStart + token.raw.length]);
      } else {
        if (token.tokens) findCodeRanges(token.tokens, token.raw, absoluteStart);
        if (token.items) findCodeRanges(token.items, token.raw, absoluteStart);
      }
      cursor = start + token.raw.length;
    }
  };
  findCodeRanges(marked.lexer(markdownSource), markdownSource, 0);
  const imagePattern = /(!\[[^\]]*\]\(\s*)(<[^>]+>|[^\s)>]+)([^)]*\))/g;
  for (const match of markdownSource.matchAll(imagePattern)) {
    if (codeRanges.some(([start, end]) => match.index >= start && match.index < end)) continue;
    const prefix = match[1];
    const source = match[2];
    const path = source.startsWith('<') ? source.slice(1, -1) : source;
    replacements.push({ start: match.index + prefix.length, end: match.index + prefix.length + source.length, value: await collect(isRemote(path) ? path : decodeURIComponent(path)) });
  }
  let markdown = markdownSource;
  for (const { start, end, value } of replacements.reverse()) markdown = markdown.slice(0, start) + value + markdown.slice(end);
  for (const [section, field] of [['cover', 'logoUrl'], ['header', 'logoUrl'], ['style', 'watermark']]) {
    if (field === 'watermark') {
      if (theme.style.watermark?.imageUrl) theme.style.watermark.imageUrl = await collect(theme.style.watermark.imageUrl);
    } else if (theme[section]?.[field]) {
      theme[section][field] = await collect(theme[section][field]);
    }
  }

  const now = new Date().toISOString();
  return {
    id: randomUUID(), title: meta.title, createdAt: now, modifiedAt: now,
    markdown, meta, theme,
    settings: { historyEnabled: false, historyIdleMinutes: 10 },
    history: [], chatSessions: [], assets: [...assets.values()],
  };
}