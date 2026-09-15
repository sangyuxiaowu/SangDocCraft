import { describe, expect, it } from 'vitest';
import { extractImageDimensionSuffix, formatImageDimensionSuffix, parseImageDimensions } from './imageDimensions';

describe('image dimensions', () => {
  it('parses w and h in either order', () => {
    expect(parseImageDimensions('w=320 h=180')).toEqual({ width: 320, height: 180 });
    expect(parseImageDimensions('h=180 w=320')).toEqual({ height: 180, width: 320 });
  });

  it('supports a single dimension', () => {
    expect(parseImageDimensions('w=320')).toEqual({ width: 320 });
    expect(parseImageDimensions('h=180')).toEqual({ height: 180 });
  });

  it('formats only dimensions that were provided', () => {
    expect(formatImageDimensionSuffix()).toBe('');
    expect(formatImageDimensionSuffix({ width: 320 })).toBe('{w=320}');
    expect(formatImageDimensionSuffix({ width: 320, height: 180 })).toBe('{w=320 h=180}');
  });

  it('extracts only a valid leading suffix', () => {
    expect(extractImageDimensionSuffix('{w=320} 后续文本')).toEqual({
      dimensions: { width: 320 },
      length: 7,
    });
    expect(extractImageDimensionSuffix('{width=320}')).toBeUndefined();
    expect(extractImageDimensionSuffix('{w=0}')).toBeUndefined();
  });
});