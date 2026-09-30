import { generatePreparedHtml } from '../../src/utils/htmlExporter';
import { registerAssetUrls, clearDocumentAssetUrls, unregisterAssetUrl } from '../../src/utils/assetUrlRegistry';
import './docx-browser';
import type { SangDocument } from '../../src/types';

declare global {
  interface Window {
    renderSdcHtml: (input: Omit<SangDocument, 'assets'> & { assets: Array<Omit<SangDocument['assets'][number], 'data'> & { data: number[] }> }) => Promise<string>;
  }
}

window.renderSdcHtml = async (input) => {
  const assets = input.assets.map((asset) => ({ ...asset, data: Uint8Array.from(asset.data) }));
  try {
    registerAssetUrls(assets);
    return await generatePreparedHtml(input.markdown, input.meta, input.theme);
  } finally {
    clearDocumentAssetUrls();
    for (const asset of assets) {
      if (asset.scope === 'library') unregisterAssetUrl(`@library/${asset.id}`);
    }
  }
};