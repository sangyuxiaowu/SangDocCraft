export interface ImageDimensions {
  width?: number;
  height?: number;
  align?: 'left' | 'center' | 'right';
}

export interface ImageDimensionSuffix {
  dimensions: ImageDimensions;
  length: number;
}

export function parseImageDimensions(attributes?: string): ImageDimensions | undefined {
  if (!attributes) return undefined;

  const dimensions: ImageDimensions = {};
  const attributePattern = /(?:^|\s)(w|h|align)\s*=\s*(\S+)/gi;
  let remainder = attributes;
  for (const match of attributes.matchAll(attributePattern)) {
    const key = match[1].toLowerCase();
    const value = match[2].toLowerCase();
    if (key === 'align') {
      if (dimensions.align || !['left', 'center', 'right'].includes(value)) return undefined;
      dimensions.align = value as ImageDimensions['align'];
    } else {
      const dimension = key === 'w' ? 'width' : 'height';
      const numericValue = Number(value);
      if (dimensions[dimension] !== undefined || !/^\d+(?:\.\d+)?$/.test(value) || numericValue <= 0) return undefined;
      dimensions[dimension] = numericValue;
    }
    remainder = remainder.replace(match[0], ' ');
  }
  return remainder.trim() || (!dimensions.width && !dimensions.height && !dimensions.align) ? undefined : dimensions;
}

export function extractImageDimensionSuffix(text?: string): ImageDimensionSuffix | undefined {
  const suffixMatch = text?.match(/^\s*\{([^{}]*)\}/);
  if (!suffixMatch) return undefined;

  const dimensions = parseImageDimensions(suffixMatch[1]);
  return dimensions ? { dimensions, length: suffixMatch[0].length } : undefined;
}

export function formatImageDimensionSuffix(dimensions?: ImageDimensions): string {
  const attributes = [
    dimensions?.width ? `w=${dimensions.width}` : '',
    dimensions?.height ? `h=${dimensions.height}` : '',
    dimensions?.align ? `align=${dimensions.align}` : '',
  ].filter(Boolean);
  return attributes.length ? `{${attributes.join(' ')}}` : '';
}