export interface ImageDimensions {
  width?: number;
  height?: number;
}

export interface ImageDimensionSuffix {
  dimensions: ImageDimensions;
  length: number;
}

export function parseImageDimensions(attributes?: string): ImageDimensions | undefined {
  if (!attributes) return undefined;

  const dimensions: ImageDimensions = {};
  const attributePattern = /(w|h)\s*=\s*(\d+(?:\.\d+)?)/gi;
  const remainder = attributes.replace(attributePattern, '').trim();
  if (remainder) return undefined;

  for (const match of attributes.matchAll(attributePattern)) {
    const key = match[1].toLowerCase() === 'w' ? 'width' : 'height';
    const value = Number(match[2]);
    if (dimensions[key] !== undefined || !Number.isFinite(value) || value <= 0) return undefined;
    dimensions[key] = value;
  }

  return dimensions.width || dimensions.height ? dimensions : undefined;
}

export function extractImageDimensionSuffix(text?: string): ImageDimensionSuffix | undefined {
  const suffixMatch = text?.match(/^\s*\{([^{}]*)\}/);
  if (!suffixMatch) return undefined;

  const dimensions = parseImageDimensions(suffixMatch[1]);
  return dimensions ? { dimensions, length: suffixMatch[0].length } : undefined;
}