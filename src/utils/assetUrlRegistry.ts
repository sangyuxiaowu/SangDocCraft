import type { DocumentAsset } from '../types';

const assetUrls = new Map<string, string>();
const assetData = new Map<string, DocumentAsset>();

export function getAssetReference(asset: DocumentAsset): string {
  return `@${asset.scope === 'library' ? 'library' : 'images'}/${asset.id}`;
}

export function registerAssetUrl(asset: DocumentAsset): string {
  const reference = getAssetReference(asset);
  const previousUrl = assetUrls.get(reference);
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  const url = URL.createObjectURL(new Blob([new Uint8Array(asset.data)], { type: asset.mediaType }));
  assetUrls.set(reference, url);
  assetData.set(reference, asset);
  return url;
}

export function registerAssetUrls(assets: DocumentAsset[]): void {
  assets.forEach(registerAssetUrl);
}

export function resolveInternalAssetUrl(source: string): string | undefined {
  return assetUrls.get(source.trim());
}

export function getInternalAsset(source: string): DocumentAsset | undefined {
  return assetData.get(source.trim());
}

export function unregisterAssetUrl(reference: string): void {
  const url = assetUrls.get(reference);
  if (url) URL.revokeObjectURL(url);
  assetUrls.delete(reference);
  assetData.delete(reference);
}

export function clearDocumentAssetUrls(): void {
  for (const reference of assetUrls.keys()) {
    if (reference.startsWith('@images/')) unregisterAssetUrl(reference);
  }
}