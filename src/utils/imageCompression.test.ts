import { describe, expect, it } from 'vitest';
import { computeResampleSize } from './imageCompression';

describe('computeResampleSize', () => {
  it('downscales by the display width times the clarity scale', () => {
    expect(computeResampleSize({ width: 2000, height: 1000 }, { width: 500 }, 2))
      .toEqual({ width: 1000, height: 500 });
  });

  it('never upscales beyond the original size', () => {
    expect(computeResampleSize({ width: 800, height: 400 }, { width: 600 }, 2)).toBeUndefined();
  });

  it('keeps enough pixels for each specified display dimension', () => {
    expect(computeResampleSize({ width: 2000, height: 1000 }, { width: 500, height: 200 }, 2))
      .toEqual({ width: 1000, height: 500 });
  });

  it('supports height-only settings and ignores missing or invalid ones', () => {
    expect(computeResampleSize({ width: 800, height: 400 }, { height: 100 }, 2))
      .toEqual({ width: 400, height: 200 });
    expect(computeResampleSize({ width: 800, height: 400 }, undefined, 2)).toBeUndefined();
    expect(computeResampleSize({ width: 800, height: 400 }, {}, 2)).toBeUndefined();
    expect(computeResampleSize({ width: 800, height: 400 }, { width: 400 }, 0)).toBeUndefined();
  });
});
