import type { DocumentAsset } from '../types';
import { createDocumentAsset } from './documentPackage';
import type { ImageDimensions } from './imageDimensions';

export interface ImageSize {
  width: number;
  height: number;
}

export interface WebpRenderOptions {
  quality: number;
  /** 文档中设置的显示尺寸（px）：提供时按 显示尺寸 × scale 重新采样 */
  display?: ImageDimensions;
  /** 清晰度倍率，默认为 1 */
  scale?: number;
}

export interface WebpRenderResult {
  asset: DocumentAsset;
  originalSize: ImageSize;
  outputSize: ImageSize;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('浏览器无法生成 WebP 图片')),
      'image/webp',
      quality,
    );
  });
}

/**
 * 按显示尺寸与清晰度倍率计算应重采样的像素尺寸。
 * 缺少显示尺寸、倍率无效或无需缩小时返回 undefined（永不放大原图）。
 */
export function computeResampleSize(
  original: ImageSize,
  display?: ImageDimensions,
  scale = 1,
): ImageSize | undefined {
  if (!display || original.width <= 0 || original.height <= 0 || scale <= 0) return undefined;

  const ratios = [
    display.width ? (display.width * scale) / original.width : undefined,
    display.height ? (display.height * scale) / original.height : undefined,
  ].filter((ratio): ratio is number => ratio !== undefined);
  if (ratios.length === 0) return undefined;

  // 保留每个已指定显示维度所需的像素，避免非等比显示时其中一维清晰度不足。
  const factor = Math.min(1, Math.max(...ratios));
  if (factor >= 1) return undefined;

  const width = Math.max(1, Math.round(original.width * factor));
  const height = Math.max(1, Math.round(original.height * factor));
  return width === original.width && height === original.height ? undefined : { width, height };
}

/** 将图片渲染为 WebP，可选按显示尺寸重新采样，返回原图与输出尺寸用于统计 */
export async function renderAssetToWebp(
  asset: DocumentAsset,
  options: WebpRenderOptions,
): Promise<WebpRenderResult> {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(asset.data)], { type: asset.mediaType }));
  try {
    const originalSize = { width: bitmap.width, height: bitmap.height };
    const outputSize = computeResampleSize(originalSize, options.display, options.scale) ?? originalSize;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize.width;
    canvas.height = outputSize.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法创建图片压缩画布');
    context.drawImage(bitmap, 0, 0, outputSize.width, outputSize.height);
    const blob = await canvasToBlob(canvas, Math.min(1, Math.max(0.1, options.quality)));
    const created = await createDocumentAsset(new Uint8Array(await blob.arrayBuffer()), {
      fileName: asset.fileName.replace(/\.[^.]+$/, '') + '.webp',
      description: asset.description,
      mediaType: 'image/webp',
      scope: asset.scope,
    });
    return { asset: created, originalSize, outputSize };
  } finally {
    bitmap.close();
  }
}

export async function compressAssetToWebp(asset: DocumentAsset, quality: number): Promise<DocumentAsset> {
  return (await renderAssetToWebp(asset, { quality })).asset;
}