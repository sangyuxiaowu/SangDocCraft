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

  it('accepts image alignment alone or with dimensions', () => {
    expect(parseImageDimensions('align=right')).toEqual({ align: 'right' });
    expect(parseImageDimensions('h=180 align=LEFT w=320')).toEqual({ height: 180, align: 'left', width: 320 });
    expect(parseImageDimensions('align=side')).toBeUndefined();
    expect(parseImageDimensions('w=320 align=left align=right')).toBeUndefined();
  });

  it('formats only dimensions that were provided', () => {
    expect(formatImageDimensionSuffix()).toBe('');
    expect(formatImageDimensionSuffix({ width: 320 })).toBe('{w=320}');
    expect(formatImageDimensionSuffix({ width: 320, height: 180 })).toBe('{w=320 h=180}');
    expect(formatImageDimensionSuffix({ align: 'right' })).toBe('{align=right}');
  });

  it('extracts only a valid leading suffix', () => {
    expect(extractImageDimensionSuffix('{w=320} 后续文本')).toEqual({
      dimensions: { width: 320 },
      length: 7,
    });
    expect(extractImageDimensionSuffix('{align=left} 后续文本')).toEqual({
      dimensions: { align: 'left' },
      length: 12,
    });
    expect(extractImageDimensionSuffix('{width=320}')).toBeUndefined();
    expect(extractImageDimensionSuffix('{w=0}')).toBeUndefined();
  });
});