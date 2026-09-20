import type { DocumentAsset, DocumentTheme } from '../types';
import { getAssetReference } from './assetUrlRegistry';
import { parseImageDimensions, type ImageDimensions } from './imageDimensions';
import { collectImageReferences } from './imageReferences';

/** WebP 已是目标格式，SVG 为矢量图，两者都不参与批量压缩 */
const UNSUPPORTED_MEDIA_TYPES = new Set(['image/webp', 'image/svg+xml']);

const INTERNAL_REFERENCE = '@(images|library)\\/([a-z0-9][a-z0-9-]{7,63})';
/** Markdown 图片语法：`![说明](@images/xxx){w=520}` */
const MARKDOWN_IMAGE_PATTERN = new RegExp(`!\\[[^\\]]*\\]\\(\\s*<?${INTERNAL_REFERENCE}>?[^)]*\\)\\s*(\\{[^{}]*\\})?`, 'gi');
/** 内联 `<img src="@images/xxx" />{w=520}` 语法 */
const HTML_IMAGE_PATTERN = new RegExp(`<img\\b[^>]*\\bsrc=["']${INTERNAL_REFERENCE}["'][^>]*>\\s*(\\{[^{}]*\\})?`, 'gi');
const REFERENCE_PATTERN = new RegExp(`^\\s*${INTERNAL_REFERENCE}\\s*$`, 'i');

export interface DocumentImageOptimizationPlan {
  /** 当前文档涉及的图片（文档图片 + 被引用的素材库图片）中可压缩的非 WebP 图片 */
  compressible: DocumentAsset[];
  /** 当前文档中未被正文、封面或页眉引用的文档图片 */
  unused: DocumentAsset[];
  /** 图片 ID → 文档中设置的显示尺寸（px） */
  displaySizes: Map<string, ImageDimensions>;
  /** 文档相关图片数量 */
  totalCount: number;
  /** 文档相关图片总字节数 */
  totalBytes: number;
  /** 未引用图片总字节数 */
  unusedBytes: number;
}

function mergeDimensions(current: ImageDimensions | undefined, next: ImageDimensions): ImageDimensions {
  return {
    width: Math.max(current?.width ?? 0, next.width ?? 0) || undefined,
    height: Math.max(current?.height ?? 0, next.height ?? 0) || undefined,
  };
}

/**
 * 收集正文、封面与页眉中为每张图片设置的显示尺寸（px）。
 * 同一图片被多处引用时取各维度最大值，避免按较小的显示尺寸过度降采样。
 */
export function collectAssetDisplaySizes(markdown: string, theme: DocumentTheme): Map<string, ImageDimensions> {
  const sizes = new Map<string, ImageDimensions>();
  const record = (id: string, dimensions?: ImageDimensions) => {
    if (dimensions) sizes.set(id, mergeDimensions(sizes.get(id), dimensions));
  };

  for (const pattern of [MARKDOWN_IMAGE_PATTERN, HTML_IMAGE_PATTERN]) {
    for (const match of markdown.matchAll(pattern)) {
      record(match[2], parseImageDimensions(match[3]?.slice(1, -1)));
    }
  }

  const logos: [string | undefined, number | undefined][] = [
    [theme.meta.logo, theme.meta.logoHeight],
    [theme.meta.logoUrl, theme.meta.logoHeight],
    [theme.header.logoUrl, theme.header.logoHeight],
  ];
  for (const [source, height] of logos) {
    const id = source?.match(REFERENCE_PATTERN)?.[2];
    if (id && height) record(id, { height });
  }

  return sizes;
}

function sumBytes(assets: DocumentAsset[]): number {
  return assets.reduce((total, asset) => total + asset.byteLength, 0);
}

/** 汇总当前文档的图片优化计划：可压缩图片、未引用图片与显示尺寸 */
export function planDocumentImageOptimization(
  assets: DocumentAsset[],
  markdown: string,
  theme: DocumentTheme,
): DocumentImageOptimizationPlan {
  const references = collectImageReferences(markdown, theme);
  const isReferenced = (asset: DocumentAsset) => references.has(getAssetReference(asset).toLowerCase());
  const belongsToDocument = (asset: DocumentAsset) => asset.scope === 'document' || isReferenced(asset);

  const documentAssets = assets.filter(belongsToDocument);
  const compressible = documentAssets.filter(
    (asset) => !UNSUPPORTED_MEDIA_TYPES.has(asset.mediaType.toLowerCase()),
  );
  const unused = assets.filter((asset) => asset.scope === 'document' && !isReferenced(asset));

  return {
    compressible,
    unused,
    displaySizes: collectAssetDisplaySizes(markdown, theme),
    totalCount: documentAssets.length,
    totalBytes: sumBytes(documentAssets),
    unusedBytes: sumBytes(unused),
  };
}
