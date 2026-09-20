import { isTauriEnvironment } from './tauriHelper';

const EXTERNAL_URL_PATTERN = /^(https?|mailto|tel):/i;

/** Returns true for URLs that must be handed over to the system default application. */
export function isExternalUrl(url: string): boolean {
  return EXTERNAL_URL_PATTERN.test((url || '').trim());
}

/**
 * Opens an external URL with the system default application.
 * Uses the Tauri opener plugin on desktop and falls back to a new browser tab on the web.
 * Resolves with true when the URL was handed over to the OS or the browser.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  const target = (url || '').trim();
  if (!isExternalUrl(target)) return false;

  if (isTauriEnvironment()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(target);
      return true;
    } catch (error) {
      console.warn('Tauri opener plugin failed, falling back to window.open:', target, error);
    }
  }

  if (typeof window === 'undefined') return false;
  // 'noopener' makes window.open return null even on success, so the return value is not inspected.
  window.open(target, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Routes external anchor clicks to the system browser.
 * Without this the Tauri webview would navigate the whole app window to the target URL.
 * Web builds keep their default `target="_blank"` behaviour.
 * Returns a dispose function that removes the listener again.
 */
export function installExternalLinkInterceptor(targetDocument?: Document): () => void {
  const documentRef = targetDocument ?? (typeof document === 'undefined' ? undefined : document);
  if (!documentRef) return () => undefined;

  const handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!isTauriEnvironment()) return;

    const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href') || '';
    if (!isExternalUrl(href)) return;

    event.preventDefault();
    void openExternalUrl(href);
  };

  documentRef.addEventListener('click', handleClick, true);
  return () => documentRef.removeEventListener('click', handleClick, true);
}
