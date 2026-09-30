import { createDocxBlob } from '../../src/utils/docxExporter';
import { clearDocumentAssetUrls, registerAssetUrls, unregisterAssetUrl } from '../../src/utils/assetUrlRegistry';
import type { SangDocument } from '../../src/types';

declare global {
  interface Window {
    exportSdcDocx: (input: Omit<SangDocument, 'assets'> & { assets: Array<Omit<SangDocument['assets'][number], 'data'> & { data: number[] }> }) => Promise<number[]>;
  }
}

window.exportSdcDocx = async (input) => {
  const assets = input.assets.map((asset) => ({ ...asset, data: Uint8Array.from(asset.data) }));
  try {
    registerAssetUrls(assets);
    const blob = await createDocxBlob(input.markdown, input.meta, input.theme);
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  } finally {
    clearDocumentAssetUrls();
    for (const asset of assets) {
      if (asset.scope === 'library') unregisterAssetUrl(`@library/${asset.id}`);
    }
  }
};