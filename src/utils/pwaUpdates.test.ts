// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerPwaUpdates } from './pwaUpdates';

function setup(controlled = true) {
  vi.useFakeTimers();
  const waiting = Object.assign(new EventTarget(), { postMessage: vi.fn() });
  const registration = Object.assign(new EventTarget(), {
    waiting: null as typeof waiting | null,
    installing: null as (EventTarget & { state: string }) | null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  const serviceWorker = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
    register: vi.fn().mockResolvedValue(registration),
  });
  const documentMock = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const windowMock = Object.assign(new EventTarget(), {
    setInterval,
    confirm: vi.fn().mockReturnValue(true),
    location: { reload: vi.fn() },
  });
  const navigatorMock = { serviceWorker, onLine: true };
  vi.stubGlobal('navigator', navigatorMock);
  vi.stubGlobal('document', documentMock);
  vi.stubGlobal('window', windowMock);
  return { waiting, registration, serviceWorker, documentMock, windowMock, navigatorMock };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PWA updates', () => {
  it('uses the deployment base and bypasses the HTTP cache for worker updates', async () => {
    const { serviceWorker, registration } = setup();
    await registerPwaUpdates('/SangDocCraft/');
    expect(serviceWorker.register).toHaveBeenCalledWith('/SangDocCraft/sw.js', {
      scope: '/SangDocCraft/', updateViaCache: 'none',
    });
    expect(registration.update).toHaveBeenCalledOnce();
  });

  it('checks hourly, on reconnect, and on returning to the foreground', async () => {
    const { registration, documentMock, windowMock, navigatorMock } = setup();
    await registerPwaUpdates('/');
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(registration.update).toHaveBeenCalledTimes(2);
    navigatorMock.onLine = false;
    windowMock.dispatchEvent(new Event('online'));
    expect(registration.update).toHaveBeenCalledTimes(2);
    navigatorMock.onLine = true;
    windowMock.dispatchEvent(new Event('online'));
    await Promise.resolve();
    documentMock.visibilityState = 'hidden';
    documentMock.dispatchEvent(new Event('visibilitychange'));
    expect(registration.update).toHaveBeenCalledTimes(3);
    documentMock.visibilityState = 'visible';
    documentMock.dispatchEvent(new Event('visibilitychange'));
    expect(registration.update).toHaveBeenCalledTimes(4);
  });

  it('activates a waiting update only after confirmation and reloads once', async () => {
    const { waiting, registration, serviceWorker, windowMock } = setup();
    registration.waiting = waiting;
    await registerPwaUpdates('/');
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(windowMock.location.reload).not.toHaveBeenCalled();
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(windowMock.location.reload).toHaveBeenCalledOnce();
    expect(windowMock.confirm).toHaveBeenCalledOnce();
  });

  it('detects a newly installed update and respects a declined refresh', async () => {
    const { waiting, registration, windowMock } = setup();
    windowMock.confirm.mockReturnValue(false);
    await registerPwaUpdates('/');
    const installing = Object.assign(new EventTarget(), { state: 'installing' });
    registration.installing = installing;
    registration.dispatchEvent(new Event('updatefound'));
    registration.waiting = waiting;
    installing.state = 'installed';
    installing.dispatchEvent(new Event('statechange'));
    installing.dispatchEvent(new Event('statechange'));
    expect(windowMock.confirm).toHaveBeenCalledOnce();
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(windowMock.location.reload).not.toHaveBeenCalled();
  });

  it('does not prompt or reload on the first offline installation', async () => {
    const { registration, waiting, serviceWorker, windowMock } = setup(false);
    registration.waiting = waiting;
    await registerPwaUpdates('/');
    serviceWorker.dispatchEvent(new Event('controllerchange'));
    expect(windowMock.confirm).not.toHaveBeenCalled();
    expect(windowMock.location.reload).not.toHaveBeenCalled();
  });

  it('handles offline update failures without an unhandled rejection', async () => {
    const { registration } = setup();
    registration.update.mockRejectedValue(new Error('offline'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await registerPwaUpdates('/');
    await Promise.resolve();
    expect(warning).toHaveBeenCalledWith('PWA update check failed:', expect.any(Error));
  });
});