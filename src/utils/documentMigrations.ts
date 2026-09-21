import { PRESET_THEMES } from '../data/presetThemes';
import type { DocumentHistoryEntry, DocumentTheme } from '../types';

export const CURRENT_DOCUMENT_FORMAT_VERSION = 2;

interface VersionedDocumentData {
  theme: DocumentTheme;
  history: DocumentHistoryEntry[];
}

function migrateV1ToV2(document: VersionedDocumentData): VersionedDocumentData {
  const migrateTheme = (theme: DocumentTheme): DocumentTheme => {
    const { showCover, coverStyle, logoUrl, logoHeight, coverlist, coverListColumns, ...meta } = theme.meta as DocumentTheme['meta'] & Record<string, unknown>;
    return { ...theme, meta, cover: { ...PRESET_THEMES[0].cover } };
  };

  return {
    theme: migrateTheme(document.theme),
    history: document.history.map((entry) => ({ ...entry, theme: migrateTheme(entry.theme) })),
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
  return migrated;
}