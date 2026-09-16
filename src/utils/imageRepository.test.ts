import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRegisteredThemes } from '../themes/themeRegistry';
import { createDocumentAsset } from './documentPackage';
import {
  cleanupOrphanDocumentAssets,
  clearDocumentAssets,
  listDocumentAssets,
  listLibraryAssets,
  putDocumentAsset,
  putLibraryAsset,
} from './imageRepository';
import { isImageReferenced } from './imageReferences';

describe('image repository', () => {
  beforeEach(async () => {
    await clearDocumentAssets('doc-a');
    await clearDocumentAssets('doc-b');
  });

  it('clears one document without deleting another document or the permanent library', async () => {
    const documentAsset = await createDocumentAsset(new Uint8Array([1]), {
      fileName: 'document.png',
      mediaType: 'image/png',
    });
    const libraryAsset = await createDocumentAsset(new Uint8Array([2]), {
      fileName: 'library.png',
      mediaType: 'image/png',
      scope: 'library',
    });
    await putDocumentAsset('doc-a', documentAsset);
    await putDocumentAsset('doc-b', documentAsset);
    await putLibraryAsset(libraryAsset);

    await clearDocumentAssets('doc-a');

    expect(await listDocumentAssets('doc-a')).toEqual([]);
    expect(await listDocumentAssets('doc-b')).toHaveLength(1);
    expect((await listLibraryAssets()).some((asset) => asset.id === libraryAsset.id)).toBe(true);
  });

  it('detects references in markdown, cover and header theme settings', async () => {
    const theme = structuredClone(getRegisteredThemes()[0]);
    theme.meta.logoUrl = '@library/img-12345678';
    theme.header.logoUrl = '@images/img-87654321';

    expect(isImageReferenced('img-abcdefgh', 'document', '![图](@images/img-abcdefgh)', theme)).toBe(true);
    expect(isImageReferenced('img-12345678', 'library', '', theme)).toBe(true);
    expect(isImageReferenced('img-87654321', 'document', '', theme)).toBe(true);
    expect(isImageReferenced('img-unused00', 'document', '', theme)).toBe(false);
  });

  it('cleans up orphan document assets while retaining valid document assets and library assets', async () => {
    const asset1 = await createDocumentAsset(new Uint8Array([10]), { fileName: 'a.png', mediaType: 'image/png' });
    const asset2 = await createDocumentAsset(new Uint8Array([20]), { fileName: 'b.png', mediaType: 'image/png' });
    const asset3 = await createDocumentAsset(new Uint8Array([30]), { fileName: 'c.png', mediaType: 'image/png' });

    await putDocumentAsset('doc-valid-1', asset1);
    await putDocumentAsset('doc-valid-2', asset2);
    await putDocumentAsset('doc-orphan', asset3);

    const validIds = new Set(['doc-valid-1', 'doc-valid-2']);
    const deleted = await cleanupOrphanDocumentAssets(validIds);

    expect(deleted).toBe(1);
    expect(await listDocumentAssets('doc-valid-1')).toHaveLength(1);
    expect(await listDocumentAssets('doc-valid-2')).toHaveLength(1);
    expect(await listDocumentAssets('doc-orphan')).toHaveLength(0);
  });
});