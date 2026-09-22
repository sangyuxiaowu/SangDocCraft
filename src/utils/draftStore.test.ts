import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRegisteredThemes } from '../themes/themeRegistry';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { createDocumentAsset } from './documentPackage';
import { listDocumentAssets, putDocumentAsset } from './imageRepository';
import {
  clearAllDrafts,
  clearAllDraftsWithAssets,
  CURRENT_DRAFT_FORMAT_VERSION,
  deleteDraftWithAssets,
  getAllDrafts,
  getDraft,
  getUnsavedDrafts,
  getUnsavedDraftSummaries,
  markDraftSaved,
  runStorageGC,
  saveDraft,
} from './draftStore';

describe('draftStore and multi-document asset management', () => {
  const theme = getRegisteredThemes()[0];
  const meta = { ...DEFAULT_DOCUMENT_META, title: '测试草稿' };

  const putStoredDraft = async (draft: object) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('sangdoccraft-drafts', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction('drafts', 'readwrite').objectStore('drafts').put(draft);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  beforeEach(async () => {
    await clearAllDrafts();
  });

  it('supports multiple independent drafts without overwriting each other', async () => {
    await saveDraft({
      formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
      documentId: 'draft-1',
      createdAt: new Date().toISOString(),
      updatedAt: '2026-09-16T01:00:00.000Z',
      markdown: '# Draft 1',
      meta,
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
      savedToSdc: false,
    });

    await saveDraft({
      formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
      documentId: 'draft-2',
      createdAt: new Date().toISOString(),
      updatedAt: '2026-09-16T02:00:00.000Z',
      markdown: '# Draft 2',
      meta,
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
      savedToSdc: false,
    });

    const all = await getAllDrafts();
    expect(all).toHaveLength(2);
    expect(all[0].documentId).toBe('draft-2'); // Sorted descending by updatedAt
    expect(all[1].documentId).toBe('draft-1');

    const d1 = await getDraft('draft-1');
    expect(d1?.markdown).toBe('# Draft 1');

    const d2 = await getDraft('draft-2');
    expect(d2?.markdown).toBe('# Draft 2');
  });

  it('marks draft as saved and filters in getUnsavedDrafts', async () => {
    await saveDraft({
      formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
      documentId: 'draft-export',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Exported',
      meta,
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
      savedToSdc: false,
    });

    expect(await getUnsavedDrafts()).toHaveLength(1);

    await markDraftSaved('draft-export', true);

    expect(await getUnsavedDrafts()).toHaveLength(0);
    expect(await getAllDrafts()).toHaveLength(1);
  });

  it('deletes draft and cleans up its associated assets together', async () => {
    await saveDraft({
      formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
      documentId: 'doc-to-delete',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Delete Me',
      meta,
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
    });

    const asset = await createDocumentAsset(new Uint8Array([1, 2, 3]), {
      fileName: 'img.png',
      mediaType: 'image/png',
    });
    await putDocumentAsset('doc-to-delete', asset);

    expect(await listDocumentAssets('doc-to-delete')).toHaveLength(1);

    await deleteDraftWithAssets('doc-to-delete');

    expect(await getDraft('doc-to-delete')).toBeUndefined();
    expect(await listDocumentAssets('doc-to-delete')).toHaveLength(0);
  });

  it('cleans up orphan assets using runStorageGC without removing valid drafts', async () => {
    await saveDraft({
      formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
      documentId: 'draft-kept',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Kept Draft',
      meta,
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
    });

    const assetKept = await createDocumentAsset(new Uint8Array([5]), { fileName: 'kept.png', mediaType: 'image/png' });
    const assetOrphan = await createDocumentAsset(new Uint8Array([9]), { fileName: 'orphan.png', mediaType: 'image/png' });

    await putDocumentAsset('draft-kept', assetKept);
    await putDocumentAsset('doc-ghost', assetOrphan);

    // GC should retain draft-kept and delete doc-ghost
    const cleaned = await runStorageGC();
    expect(cleaned).toBeGreaterThanOrEqual(1);

    expect(await listDocumentAssets('draft-kept')).toHaveLength(1);
    expect(await listDocumentAssets('doc-ghost')).toHaveLength(0);
  });

  it('clearAllDraftsWithAssets respects active document if specified', async () => {
    await saveDraft({
      formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
      documentId: 'doc-active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Active Doc',
      meta,
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
    });
    await saveDraft({
      formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
      documentId: 'doc-other',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Other Doc',
      meta,
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
    });

    const assetActive = await createDocumentAsset(new Uint8Array([1]), { fileName: '1.png', mediaType: 'image/png' });
    const assetOther = await createDocumentAsset(new Uint8Array([2]), { fileName: '2.png', mediaType: 'image/png' });
    await putDocumentAsset('doc-active', assetActive);
    await putDocumentAsset('doc-other', assetOther);

    await clearAllDraftsWithAssets('doc-active');

    expect(await getDraft('doc-active')).toBeDefined();
    expect(await getDraft('doc-other')).toBeUndefined();
    expect(await listDocumentAssets('doc-active')).toHaveLength(1);
    expect(await listDocumentAssets('doc-other')).toHaveLength(0);
  });

  it('migrates a legacy draft once and writes it back with the current version', async () => {
    const legacyTheme = { ...theme, meta: { ...meta, logoUrl: 'old-logo.png' } } as Record<string, unknown>;
    delete legacyTheme.cover;
    await putStoredDraft({
      documentId: 'legacy-draft',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T01:00:00.000Z',
      markdown: '# Legacy',
      theme: legacyTheme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
    });

    const restored = await getDraft('legacy-draft');
    expect(restored?.formatVersion).toBe(CURRENT_DRAFT_FORMAT_VERSION);
    expect(restored?.theme.cover).toEqual({ ...theme.cover, logoUrl: 'old-logo.png' });
    expect(restored?.meta.title).toBe(meta.title);
    expect(restored?.markdown).toBe('# Legacy');

    const stored = await getDraft('legacy-draft');
    expect(stored?.formatVersion).toBe(CURRENT_DRAFT_FORMAT_VERSION);
  });

  it('lists an incomplete draft safely and preserves its body while filling theme defaults', async () => {
    await putStoredDraft({
      formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
      documentId: 'broken-theme',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T01:00:00.000Z',
      markdown: '# Recover Me',
      theme: { id: 'broken', name: 'Broken' },
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
    });

    expect(await getUnsavedDraftSummaries()).toEqual([expect.objectContaining({
      documentId: 'broken-theme',
      title: 'Recover Me',
      themeName: 'Broken',
    })]);
    const restored = await getDraft('broken-theme');
    expect(restored?.markdown).toBe('# Recover Me');
    expect(restored?.theme).toEqual(expect.objectContaining({
      id: 'broken',
      name: 'Broken',
      cover: theme.cover,
      style: theme.style,
    }));
  });
});
