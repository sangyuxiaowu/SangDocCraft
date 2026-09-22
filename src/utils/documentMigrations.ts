import { PRESET_THEMES } from '../data/presetThemes';
import type { DocumentHistoryEntry, DocumentTheme } from '../types';

export const CURRENT_DOCUMENT_FORMAT_VERSION = 2;
export const CURRENT_THEME_FORMAT_VERSION = 2;

interface VersionedDocumentData {
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
  const { showCover, coverStyle, logoUrl, logoHeight, coverlist, coverListColumns, ...meta } = legacyMeta;
  return { ...source, meta, cover: { ...PRESET_THEMES[0].cover } } as unknown as DocumentTheme;
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
  const normalized = mergeMissingFields(PRESET_THEMES[0], migrated);
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

function migrateV1ToV2(document: VersionedDocumentData): VersionedDocumentData {

  return {
    theme: migrateThemeData(1, document.theme),
    history: document.history.map((entry) => ({ ...entry, theme: migrateThemeData(1, entry.theme) })),
  };
}

const migrations: Record<number, (document: VersionedDocumentData) => VersionedDocumentData> = {
  1: migrateV1ToV2,
};

/** 按版本顺序升级解包后的文档数据到当前格式。 */
export function migrateDocumentData(fromVersion: number, document: VersionedDocumentData): VersionedDocumentData {
  let migrated = document;
  for (let version = fromVersion; version < CURRENT_DOCUMENT_FORMAT_VERSION; version++) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`缺少文档格式 v${version} 到 v${version + 1} 的升级逻辑`);
    migrated = migrate(migrated);
  }
  return {
    theme: migrateThemeData(CURRENT_THEME_FORMAT_VERSION, migrated.theme),
    history: migrated.history.map((entry) => ({
      ...entry,
      theme: migrateThemeData(CURRENT_THEME_FORMAT_VERSION, entry.theme),
    })),
  };
}