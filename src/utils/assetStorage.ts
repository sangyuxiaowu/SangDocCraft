import type { DocumentAsset } from '../types';
import { getAssetReference, registerAssetUrl, unregisterAssetUrl } from './assetUrlRegistry';
import { deleteAsset, putDocumentAsset, putLibraryAsset } from './imageRepository';

/** 按作用域写入图片，并刷新内存中的预览 URL */
export async function saveAsset(documentId: string, asset: DocumentAsset): Promise<void> {
  if (asset.scope === 'library') await putLibraryAsset(asset);
  else await putDocumentAsset(documentId, asset);
  registerAssetUrl(asset);
}

/** 删除图片并释放其预览 URL */
export async function removeAsset(documentId: string, asset: DocumentAsset): Promise<void> {
  await deleteAsset(documentId, asset);
  unregisterAssetUrl(getAssetReference(asset));
}
