const UPDATE_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_MESSAGE = '发现应用新版本。请确认文档已保存，是否立即更新并刷新？';

export async function registerPwaUpdates(baseUrl: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const serviceWorker = navigator.serviceWorker;
    let hadController = Boolean(serviceWorker.controller);
    let reloadRequested = false;
    let reloaded = false;
    let promptedWorker: ServiceWorker | null = null;

    serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloaded) return;
      if (reloadRequested || window.confirm(UPDATE_MESSAGE)) {
        reloaded = true;
        window.location.reload();
      }
    });

    const registration = await serviceWorker.register(`${baseUrl}sw.js`, {
      scope: baseUrl,
      updateViaCache: 'none',
    });

    const promptUpdate = () => {
      const waiting = registration.waiting;
      if (!waiting || !serviceWorker.controller || promptedWorker === waiting) return;
      promptedWorker = waiting;
      if (window.confirm(UPDATE_MESSAGE)) {
        reloadRequested = true;
        waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    };

    const watchInstalling = () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed') promptUpdate();
      });
    };
    registration.addEventListener('updatefound', watchInstalling);
    watchInstalling();
    promptUpdate();

    let checking = false;
    const checkForUpdate = async () => {
      if (!navigator.onLine || document.visibilityState !== 'visible'
        || registration.installing || checking) return;
      checking = true;
      try {
        await registration.update();
      } catch (error) {
        console.warn('PWA update check failed:', error);
      } finally {
        checking = false;
      }
    };

    window.setInterval(() => void checkForUpdate(), UPDATE_INTERVAL_MS);
    window.addEventListener('online', () => void checkForUpdate());
    document.addEventListener('visibilitychange', () => void checkForUpdate());
    void checkForUpdate();
  } catch (error) {
    console.warn('PWA registration failed:', error);
  }
}