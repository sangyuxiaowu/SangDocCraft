import { marked, type Token, type Tokens } from 'marked';
import type { DocumentAsset, DocumentTheme } from '../types';
import { createDocumentAsset } from './documentPackage';
import { fetchImageBinary } from './tauriHelper';

interface NetworkImageSource {
  url: string;
  description: string;
}

interface CollectedNetworkImages {
  markdown: string;
  theme: DocumentTheme;
  assets: DocumentAsset[];
}

type ImageLoader = (source: string) => Promise<{ data: ArrayBuffer; contentType: string }>;

function isNetworkUrl(value?: string): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export function findNetworkImageSources(markdown: string, theme: DocumentTheme): NetworkImageSource[] {
  const sources = new Map<string, string>();
  const tokens = marked.lexer(markdown);
  marked.walkTokens(tokens, (token: Token) => {
    if (token.type === 'image') {
      const image = token as Tokens.Image;
      if (isNetworkUrl(image.href) && !sources.has(image.href)) sources.set(image.href, image.text || '文档图片');
    }
  });
  const logoSources = [
    [theme.cover.logoUrl, '封面 Logo'],
    [theme.header.logoUrl, '页眉 Logo'],
  ] as const;
  for (const [url, description] of logoSources) {
    if (isNetworkUrl(url) && !sources.has(url)) sources.set(url, description);
  }
  return [...sources].map(([url, description]) => ({ url, description }));
}

function replaceMarkdownImageSource(markdown: string, source: string, reference: string): string {
  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return markdown.replace(
    new RegExp(`(!\\[[^\\]]*\\]\\(\\s*<?)${escapedSource}(>?)(?=\\s*(?:["'][^"']*["'])?\\s*\\))`, 'g'),
    `$1${reference}$2`,
  );
}

function fileNameFromUrl(source: string, contentType: string): string {
  const pathName = decodeURIComponent(new URL(source).pathname.split('/').pop() || 'network-image');
  if (/\.[a-z0-9]+$/i.test(pathName)) return pathName;
  const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '') || 'bin';
  return `${pathName}.${extension}`;
}

export async function collectDocumentNetworkImages(
  markdown: string,
  theme: DocumentTheme,
  loader: ImageLoader = fetchImageBinary,
): Promise<CollectedNetworkImages> {
  let nextMarkdown = markdown;
  const nextTheme = structuredClone(theme);
  const assetsById = new Map<string, DocumentAsset>();

  for (const source of findNetworkImageSources(markdown, theme)) {
    const { data, contentType } = await loader(source.url);
    const asset = await createDocumentAsset(new Uint8Array(data), {
      fileName: fileNameFromUrl(source.url, contentType),
      description: source.description,
      mediaType: contentType,
    });
    assetsById.set(asset.id, asset);
    const reference = `@images/${asset.id}`;
    nextMarkdown = replaceMarkdownImageSource(nextMarkdown, source.url, reference);
    if (nextTheme.cover.logoUrl === source.url) nextTheme.cover.logoUrl = reference;
    if (nextTheme.header.logoUrl === source.url) nextTheme.header.logoUrl = reference;
  }

  return { markdown: nextMarkdown, theme: nextTheme, assets: [...assetsById.values()] };
}