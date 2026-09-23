import { PRESET_THEMES } from '../data/presetThemes';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import type { DocumentHistoryEntry, DocumentMeta, DocumentTheme } from '../types';

export const CURRENT_DOCUMENT_FORMAT_VERSION = 2;
export const CURRENT_THEME_FORMAT_VERSION = 2;

interface VersionedDocumentData {
  meta?: unknown;
  theme: unknown;
  history: Array<Partial<DocumentHistoryEntry> & { theme: unknown }>;
}

interface MigratedDocumentData {
  meta: DocumentMeta;
  theme: DocumentTheme;
  history: DocumentHistoryEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mergeMissingFields<T>(defaults: T, value: unknown): T {
  if (Array.isArray(defaults)) {
    return structuredClone(Array.isArray(value) ? value : defaults) as T;
  }
  if (isRecord(defaults)) {
    const source = isRecord(value) ? value : {};
    const merged: Record<string, unknown> = { ...source };
    for (const [key, defaultValue] of Object.entries(defaults)) {
      merged[key] = mergeMissingFields(defaultValue, source[key]);
    }
    return merged as T;
  }
  return (value === undefined || value === null ? defaults : value) as T;
}

function migrateV1Theme(theme: DocumentTheme): DocumentTheme {
  const source: Record<string, unknown> = isRecord(theme) ? theme : {};
  const legacyMeta = isRecord(source.meta) ? source.meta : {};
  const { meta: _, ...themeWithoutMeta } = source;
  const { showCover, coverStyle, logoUrl, logoHeight, coverlist, coverListColumns } = legacyMeta;
  return {
    ...themeWithoutMeta,
    cover: {
      ...PRESET_THEMES[0].cover,
      ...(typeof showCover === 'boolean' ? { showCover } : {}),
      ...(typeof coverStyle === 'string' ? { coverStyle } : {}),
      ...(typeof logoUrl === 'string' ? { logoUrl } : {}),
      ...(typeof logoHeight === 'number' ? { logoHeight } : {}),
      ...(Array.isArray(coverlist) ? { coverlist } : {}),
      ...(coverListColumns === 1 || coverListColumns === 2 ? { coverListColumns } : {}),
    },
  } as unknown as DocumentTheme;
}

const themeMigrations: Record<number, (theme: DocumentTheme) => DocumentTheme> = {
  1: migrateV1Theme,
};

/** 将任意持久化入口中的主题升级到当前结构，并用默认主题补齐所有缺失字段。 */
export function migrateThemeData(fromVersion: number, value: unknown): DocumentTheme {
  if (!Number.isInteger(fromVersion) || fromVersion < 1 || fromVersion > CURRENT_THEME_FORMAT_VERSION) {
    throw new Error(`不支持的主题格式版本: ${fromVersion}`);
  }

  if (!isRecord(value)) throw new Error('主题必须是有效的对象');

  let migrated = value as unknown as DocumentTheme;
  for (let version = fromVersion; version < CURRENT_THEME_FORMAT_VERSION; version++) {
    const migrate = themeMigrations[version];
    if (!migrate) throw new Error(`缺少主题格式 v${version} 到 v${version + 1} 的升级逻辑`);
    migrated = migrate(migrated);
  }
  const { meta: _, ...themeOnly } = migrated as unknown as Record<string, unknown>;
  const normalized = mergeMissingFields(PRESET_THEMES[0], themeOnly);
  if (normalized.mermaid && ((normalized.mermaid.theme as string) === 'auto' || !normalized.mermaid.theme)) {
    normalized.mermaid.theme = 'neutral';
  }
  console.info('[SangDocCraft] 主题处理完成', {
    fromVersion,
    toVersion: CURRENT_THEME_FORMAT_VERSION,
    theme: normalized,
  });
  return normalized;
}

/** 仅用于没有显式版本号的旧主题存储。 */
export function inferThemeFormatVersion(value: unknown): number {
  if (!value || typeof value !== 'object') return CURRENT_THEME_FORMAT_VERSION;
  return 'cover' in value ? CURRENT_THEME_FORMAT_VERSION : 1;
}

export function normalizeDocumentMeta(value: unknown): DocumentMeta {
  const source = isRecord(value) ? value : {};
  const text = (key: keyof DocumentMeta): string => typeof source[key] === 'string' ? source[key] : '';
  const optionalText = (key: 'number' | 'version'): string | undefined => (
    typeof source[key] === 'string' ? source[key] : undefined
  );
  return {
    ...DEFAULT_DOCUMENT_META,
    title: text('title'),
    subtitle: text('subtitle'),
    author: text('author'),
    department: text('department'),
    organization: text('organization'),
    date: text('date'),
    number: optionalText('number'),
    version: optionalText('version'),
  };
}

function extractEmbeddedMeta(theme: unknown): unknown {
  return isRecord(theme) ? theme.meta : undefined;
}

function migrateHistoryEntry(entry: VersionedDocumentData['history'][number], themeVersion: number): DocumentHistoryEntry {
  return {
    id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
    reason: entry.reason === 'manual' ? 'manual' : 'idle',
    contentHash: typeof entry.contentHash === 'string' ? entry.contentHash : '',
    markdown: typeof entry.markdown === 'string' ? entry.markdown : '',
    meta: normalizeDocumentMeta(entry.meta ?? extractEmbeddedMeta(entry.theme)),
    theme: migrateThemeData(themeVersion, entry.theme),
  };
}

function migrateV1ToV2(document: VersionedDocumentData): MigratedDocumentData {

  return {
    meta: normalizeDocumentMeta(document.meta ?? extractEmbeddedMeta(document.theme)),
    theme: migrateThemeData(1, document.theme),
    history: document.history.map((entry) => migrateHistoryEntry(entry, 1)),
  };
}

const migrations: Record<number, (document: VersionedDocumentData) => MigratedDocumentData> = {
  1: migrateV1ToV2,
};

/** 按版本顺序升级解包后的文档数据到当前格式。 */
export function migrateDocumentData(fromVersion: number, document: VersionedDocumentData): MigratedDocumentData {
  let migrated = document;
  for (let version = fromVersion; version < CURRENT_DOCUMENT_FORMAT_VERSION; version++) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`缺少文档格式 v${version} 到 v${version + 1} 的升级逻辑`);
    migrated = migrate(migrated);
  }
  return {
    meta: normalizeDocumentMeta(migrated.meta ?? extractEmbeddedMeta(migrated.theme)),
    theme: migrateThemeData(CURRENT_THEME_FORMAT_VERSION, migrated.theme),
    history: migrated.history.map((entry) => migrateHistoryEntry(entry, CURRENT_THEME_FORMAT_VERSION)),
  };
}