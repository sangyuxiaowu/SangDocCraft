import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type {
  DocumentAsset,
  DocumentAssetMetadata,
  DocumentAssetScope,
  DocumentHistoryEntry,
  DocumentSettings,
  DocumentTheme,
  SangDocument,
} from '../types';
import type { DocumentChatSession } from '../types/ai';

export const SANG_DOCUMENT_EXTENSION = 'sdc';
export const SANG_DOCUMENT_MIME_TYPE = 'application/vnd.sangdoccraft.document+zip';
export const SANG_DOCUMENT_FORMAT_VERSION = 1;

interface DocumentManifest {
  format: 'SangDocCraft';
  formatVersion: number;
  documentId: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
}

interface ImageIndex {
  images: DocumentAssetMetadata[];
}

function parseJson<T>(files: Record<string, Uint8Array>, path: string): T {
  const content = files[path];
  if (!content) throw new Error(`文档包缺少 ${path}`);
  try {
    return JSON.parse(strFromU8(content)) as T;
  } catch {
    throw new Error(`文档包中的 ${path} 不是有效 JSON`);
  }
}

function assertAssetId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]{7,63}$/i.test(id)) {
    throw new Error(`无效的图片 ID: ${id}`);
  }
}

function extensionForMediaType(mediaType: string): string {
  const subtype = mediaType.split('/')[1]?.toLowerCase();
  if (subtype === 'jpeg') return 'jpg';
  return subtype?.replace(/[^a-z0-9]/g, '') || 'bin';
}

function assetPath(asset: DocumentAssetMetadata): string {
  assertAssetId(asset.id);
  return `images/${asset.id}.${extensionForMediaType(asset.mediaType)}`;
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const source = new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', source.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createDocumentAsset(
  data: Uint8Array,
  options: {
    fileName: string;
    description?: string;
    mediaType: string;
    scope?: DocumentAssetScope;
  },
): Promise<DocumentAsset> {
  const sha256 = await sha256Hex(data);
  return {
    id: `img-${sha256.slice(0, 24)}`,
    fileName: options.fileName,
    description: options.description || '',
    mediaType: options.mediaType,
    byteLength: data.byteLength,
    sha256,
    scope: options.scope || 'document',
    data,
  };
}

export function packSangDocument(document: SangDocument): Uint8Array {
  const manifest: DocumentManifest = {
    format: 'SangDocCraft',
    formatVersion: SANG_DOCUMENT_FORMAT_VERSION,
    documentId: document.id,
    title: document.title,
    createdAt: document.createdAt,
    modifiedAt: document.modifiedAt,
  };
  const assetsByHash = new Map<string, DocumentAsset>();
  for (const asset of document.assets) {
    assertAssetId(asset.id);
    if (!assetsByHash.has(asset.sha256)) assetsByHash.set(asset.sha256, asset);
  }
  const assets = [...assetsByHash.values()];
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'document.md': strToU8(document.markdown),
    'theme.json': strToU8(JSON.stringify(document.theme, null, 2)),
    'images.json': strToU8(JSON.stringify({ images: assets.map(({ data: _, ...metadata }) => metadata) }, null, 2)),
    'settings.json': strToU8(JSON.stringify(document.settings, null, 2)),
    'history.json': strToU8(JSON.stringify(document.history, null, 2)),
    'chats.json': strToU8(JSON.stringify(document.chatSessions, null, 2)),
  };
  for (const asset of assets) files[assetPath(asset)] = asset.data;
  return zipSync(files, { level: 6 });
}

export async function unpackSangDocument(data: Uint8Array): Promise<SangDocument> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error('无法读取文档包，请确认文件是有效的 .sdc 文件');
  }
  const manifest = parseJson<DocumentManifest>(files, 'manifest.json');
  if (manifest.format !== 'SangDocCraft' || manifest.formatVersion !== SANG_DOCUMENT_FORMAT_VERSION) {
    throw new Error(`不支持的 SangDocCraft 文档版本: ${manifest.formatVersion}`);
  }
  const markdownFile = files['document.md'];
  if (!markdownFile) throw new Error('文档包缺少 document.md');
  const imageIndex = parseJson<ImageIndex>(files, 'images.json');
  const assets = await Promise.all(imageIndex.images.map(async (metadata): Promise<DocumentAsset> => {
    const assetData = files[assetPath(metadata)];
    if (!assetData) throw new Error(`文档包缺少图片 ${metadata.id}`);
    if (assetData.byteLength !== metadata.byteLength || await sha256Hex(assetData) !== metadata.sha256) {
      throw new Error(`图片 ${metadata.id} 校验失败`);
    }
    return { ...metadata, data: assetData };
  }));
  return {
    id: manifest.documentId,
    title: manifest.title,
    createdAt: manifest.createdAt,
    modifiedAt: manifest.modifiedAt,
    markdown: strFromU8(markdownFile),
    theme: parseJson<DocumentTheme>(files, 'theme.json'),
    settings: parseJson<DocumentSettings>(files, 'settings.json'),
    history: files['history.json'] ? parseJson<DocumentHistoryEntry[]>(files, 'history.json') : [],
    chatSessions: files['chats.json'] ? parseJson<DocumentChatSession[]>(files, 'chats.json') : [],
    assets,
  };
}