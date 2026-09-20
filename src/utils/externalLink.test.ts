// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn() }));

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }));

import { installExternalLinkInterceptor, isExternalUrl, openExternalUrl } from './externalLink';

const tauriWindow = window as unknown as Record<string, unknown>;

function stubWindowOpen() {
  return vi.spyOn(window, 'open').mockImplementation(() => ({}) as Window);
}

function createAnchor(href: string, attributes: Record<string, string> = {}): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = 'link';
  Object.entries(attributes).forEach(([name, value]) => anchor.setAttribute(name, value));
  document.body.appendChild(anchor);
  return anchor;
}

describe('externalLink', () => {
  beforeEach(() => {
    delete tauriWindow.__TAURI_INTERNALS__;
    delete tauriWindow.__TAURI__;
    delete tauriWindow.__TAURI_METADATA__;
    document.body.innerHTML = '';
    openUrl.mockReset();
    vi.restoreAllMocks();
  });

  it('recognizes external protocols only', () => {
    expect(isExternalUrl(' https://github.com/sangyuxiaowu/SangDocCraft ')).toBe(true);
    expect(isExternalUrl('mailto:sang@example.com')).toBe(true);
    expect(isExternalUrl('tel:10086')).toBe(true);
    expect(isExternalUrl('#heading-1')).toBe(false);
    expect(isExternalUrl('/reward-code.svg')).toBe(false);
    expect(isExternalUrl('assets/a.png')).toBe(false);
  });

  it('opens URLs through the Tauri opener plugin on desktop', async () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    openUrl.mockResolvedValue(undefined);

    await expect(openExternalUrl('https://tauri.app')).resolves.toBe(true);
    expect(openUrl).toHaveBeenCalledWith('https://tauri.app');
  });

  it('falls back to window.open on the web', async () => {
    const openSpy = stubWindowOpen();

    await expect(openExternalUrl('https://tauri.app')).resolves.toBe(true);
    expect(openSpy).toHaveBeenCalledWith('https://tauri.app', '_blank', 'noopener,noreferrer');
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('falls back to window.open when the opener plugin rejects', async () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    openUrl.mockRejectedValue(new Error('not allowed'));
    const openSpy = stubWindowOpen();

    await expect(openExternalUrl('https://tauri.app')).resolves.toBe(true);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores non external URLs', async () => {
    const openSpy = stubWindowOpen();

    await expect(openExternalUrl('#heading-1')).resolves.toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('intercepts external anchor clicks inside Tauri', async () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    openUrl.mockResolvedValue(undefined);
    const dispose = installExternalLinkInterceptor(document);
    const anchor = createAnchor('https://github.com/sangyuxiaowu/SangDocCraft', { target: '_blank' });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => {
      expect(openUrl).toHaveBeenCalledWith('https://github.com/sangyuxiaowu/SangDocCraft');
    });
    dispose();
  });

  it('leaves in-app anchors and download links untouched', () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    const dispose = installExternalLinkInterceptor(document);
    const hashAnchor = createAnchor('#heading-1');
    const downloadAnchor = createAnchor('https://example.com/a.svg', { download: 'a.svg' });

    const hashEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    hashAnchor.dispatchEvent(hashEvent);
    const downloadEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    downloadAnchor.dispatchEvent(downloadEvent);

    expect(hashEvent.defaultPrevented).toBe(false);
    expect(downloadEvent.defaultPrevented).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
    dispose();
  });

  it('keeps default browser behaviour on the web', () => {
    const dispose = installExternalLinkInterceptor(document);
    const anchor = createAnchor('https://tauri.app', { target: '_blank' });

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
    dispose();
  });

  it('stops intercepting after dispose', () => {
    tauriWindow.__TAURI_INTERNALS__ = {};
    const dispose = installExternalLinkInterceptor(document);
    dispose();
    const anchor = createAnchor('https://tauri.app');

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(openUrl).not.toHaveBeenCalled();
  });
});
