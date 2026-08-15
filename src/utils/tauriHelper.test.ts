// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { convertFileSrc, invoke } = vi.hoisted(() => ({
  convertFileSrc: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc, invoke }));

import {
  fetchImageBinary,
  isTauriEnvironment,
  resolveImageSrc,
  resolvePreviewImageSrc,
} from './tauriHelper';

const tauriWindow = window as unknown as Record<string, unknown>;

describe('tauriHelper', () => {
  beforeEach(() => {
    delete tauriWindow.__TAURI_INTERNALS__;
    delete tauriWindow.__TAURI__;
    delete tauriWindow.__TAURI_METADATA__;
    convertFileSrc.mockReset();
    invoke.mockReset();
    vi.unstubAllGlobals();
  });

  it('detects supported Tauri globals', () => {
    expect(isTauriEnvironment()).toBe(false);
    tauriWindow.__TAURI_INTERNALS__ = {};
    expect(isTauriEnvironment()).toBe(true);
  });

  it('passes web sources through and converts local Tauri paths', () => {
    expect(resolveImageSrc(' https://example.com/a.png ')).toBe('https://example.com/a.png');
    expect(resolveImageSrc('assets/a.png')).toBe('assets/a.png');

    tauriWindow.__TAURI__ = {};
    convertFileSrc.mockReturnValue('asset://converted');
    expect(resolveImageSrc('file://C:/docs/a.png')).toBe('asset://converted');
    expect(convertFileSrc).toHaveBeenCalledWith('C:/docs/a.png');
  });

  it('resolves preview paths through the native backend', async () => {
    tauriWindow.__TAURI_METADATA__ = {};
    invoke.mockResolvedValue('C:/absolute/a.png');
    convertFileSrc.mockReturnValue('asset://a.png');

    await expect(resolvePreviewImageSrc('images/a.png')).resolves.toBe('asset://a.png');
    expect(invoke).toHaveBeenCalledWith('resolve_image_path', { source: 'images/a.png' });
  });

  it('fetches web images and infers a missing content type', async () => {
    const data = new Uint8Array([1, 2, 3]).buffer;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(data),
      headers: { get: () => null },
    }));

    const result = await fetchImageBinary('image.png?version=1');
    expect(result.contentType).toBe('image/png');
    expect(new Uint8Array(result.data)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('falls back to native image reads after a browser fetch failure', async () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CORS')));
    invoke.mockResolvedValue({ bytes: [137, 80, 78, 71], contentType: 'image/png' });

    const result = await fetchImageBinary('C:/docs/a.png');
    expect(invoke).toHaveBeenCalledWith('read_image_binary', { source: 'C:/docs/a.png' });
    expect(Array.from(new Uint8Array(result.data))).toEqual([137, 80, 78, 71]);
  });
});