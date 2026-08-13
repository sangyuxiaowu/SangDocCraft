import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Helper to check if the app is currently running inside Tauri window
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    (window as any).__TAURI_METADATA__
  );
}

/**
 * Resolves an image URL or local file path to a browser-renderable src string.
 * Handles remote URLs (http/https/data/blob), relative paths, and Tauri local disk files.
 */
export function resolveImageSrc(src?: string): string {
  if (!src) return '';
  const trimmed = src.trim();
  if (!trimmed) return '';

  // Return web remote URLs or inline data URIs directly
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // If running in Tauri desktop environment, convert disk file path to asset protocol URL
  if (isTauriEnvironment()) {
    try {
      // Clean up file:// prefix if present
      let cleanPath = trimmed;
      if (cleanPath.startsWith('file://')) {
        cleanPath = cleanPath.replace(/^file:\/\//, '');
      }
      return convertFileSrc(cleanPath);
    } catch (e) {
      console.warn('Tauri convertFileSrc failed for path:', trimmed, e);
    }
  }

  // Web fallback: return relative path directly
  return trimmed;
}
