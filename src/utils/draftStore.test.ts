import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRegisteredThemes } from '../themes/themeRegistry';
import { createDocumentAsset } from './documentPackage';
import { listDocumentAssets, putDocumentAsset } from './imageRepository';
import {
  clearAllDrafts,
  clearAllDraftsWithAssets,
  deleteDraftWithAssets,
  getAllDrafts,
  getDraft,
  getUnsavedDrafts,
  markDraftSaved,
  runStorageGC,
  saveDraft,
} from './draftStore';

describe('draftStore and multi-document asset management', () => {
  const theme = getRegisteredThemes()[0];

  beforeEach(async () => {
    await clearAllDrafts();
  });

  it('supports multiple independent drafts without overwriting each other', async () => {
    await saveDraft({
      documentId: 'draft-1',
      createdAt: new Date().toISOString(),
      updatedAt: '2026-09-16T01:00:00.000Z',
      markdown: '# Draft 1',
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
      savedToSdc: false,
    });

    await saveDraft({
      documentId: 'draft-2',
      createdAt: new Date().toISOString(),
      updatedAt: '2026-09-16T02:00:00.000Z',
      markdown: '# Draft 2',
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
      documentId: 'draft-export',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Exported',
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
      documentId: 'doc-to-delete',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Delete Me',
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
      documentId: 'draft-kept',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Kept Draft',
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
      documentId: 'doc-active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Active Doc',
      theme,
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
    });
    await saveDraft({
      documentId: 'doc-other',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      markdown: '# Other Doc',
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
});
