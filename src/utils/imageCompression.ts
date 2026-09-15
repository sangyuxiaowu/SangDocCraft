import type { DocumentAsset } from '../types';
import { createDocumentAsset } from './documentPackage';

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('浏览器无法生成 WebP 图片')),
      'image/webp',
      quality,
    );
  });
}

export async function compressAssetToWebp(asset: DocumentAsset, quality: number): Promise<DocumentAsset> {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(asset.data)], { type: asset.mediaType }));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法创建图片压缩画布');
    context.drawImage(bitmap, 0, 0);
    const blob = await canvasToBlob(canvas, Math.min(1, Math.max(0.1, quality)));
    return createDocumentAsset(new Uint8Array(await blob.arrayBuffer()), {
      fileName: asset.fileName.replace(/\.[^.]+$/, '') + '.webp',
      description: asset.description,
      mediaType: 'image/webp',
      scope: asset.scope,
    });
  } finally {
    bitmap.close();
  }
}