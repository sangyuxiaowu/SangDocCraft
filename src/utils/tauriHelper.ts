import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { getInternalAsset, resolveInternalAssetUrl } from './assetUrlRegistry';

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

  const internalUrl = resolveInternalAssetUrl(trimmed);
  if (internalUrl) return internalUrl;

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

/** Resolves a local image against the Tauri process working directory for preview display. */
export async function resolvePreviewImageSrc(source?: string): Promise<string> {
  const normalizedSource = source?.trim() || '';
  if (!normalizedSource || !isTauriEnvironment() || /^(https?:|data:|blob:)/i.test(normalizedSource)) {
    return resolveImageSrc(normalizedSource);
  }

  try {
    const absolutePath = await invoke<string>('resolve_image_path', { source: normalizedSource });
    return convertFileSrc(absolutePath);
  } catch (error) {
    console.warn('Tauri preview image resolution failed:', normalizedSource, error);
    return resolveImageSrc(normalizedSource);
  }
}

function inferImageContentType(source: string): string {
  const extension = source.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'bmp') return 'image/bmp';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

interface NativeImageBinary {
  bytes: number[];
  contentType?: string;
}

/** Fetches image bytes and uses the native backend when browser CORS blocks a source. */
export async function fetchImageBinary(source: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const internalAsset = getInternalAsset(source);
  if (internalAsset) {
    const bytes = new Uint8Array(internalAsset.data);
    return { data: bytes.buffer, contentType: internalAsset.mediaType };
  }
  try {
    const response = await fetch(resolveImageSrc(source));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return {
      data: await response.arrayBuffer(),
      contentType: response.headers.get('content-type') || inferImageContentType(source),
    };
  } catch (fetchError) {
    if (!isTauriEnvironment()) throw fetchError;

    const image = await invoke<NativeImageBinary>('read_image_binary', { source });
    return {
      data: Uint8Array.from(image.bytes).buffer,
      contentType: image.contentType || inferImageContentType(source),
    };
  }
}

/**
 * Updates the Tauri window title natively.
 * Tries the custom native Tauri command 'set_window_title' first to bypass capability limitations,
 * falling back to '@tauri-apps/api/window' if available.
 */
export async function updateTauriWindowTitle(title: string): Promise<void> {
  if (!isTauriEnvironment()) return;

  try {
    await invoke('set_window_title', { title });
    return;
  } catch (nativeError) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().setTitle(title);
    } catch (apiError) {
      console.warn('Failed to update Tauri window title:', apiError, nativeError);
    }
  }
}

