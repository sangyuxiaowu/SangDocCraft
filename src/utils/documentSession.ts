const LOCK_PREFIX = 'sangdoccraft-document:';

export async function withDocumentStorageLock<T>(action: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks) return action();
  return navigator.locks.request('sangdoccraft-document-storage', action);
}

export async function acquireDocumentSession(documentId: string): Promise<() => void> {
  if (typeof navigator === 'undefined' || !navigator.locks) return () => {};
  return withDocumentStorageLock(() => new Promise<() => void>((resolve, reject) => {
    void navigator.locks.request(`${LOCK_PREFIX}${documentId}`, { ifAvailable: true }, lock => {
      if (!lock) {
        reject(new Error('此文档已在另一个窗口中编辑，请返回该窗口，或关闭它后重新打开。'));
        return;
      }
      return new Promise<void>(release => resolve(release));
    }).catch(reject);
  }));
}

export async function getActiveDocumentIds(): Promise<Set<string> | undefined> {
  if (typeof window === 'undefined') return new Set();
  // 无法确认其他窗口的活动文档时，不执行全局资源回收。
  if (!navigator.locks) return undefined;
  const { held = [], pending = [] } = await navigator.locks.query();
  return new Set([...held, ...pending]
    .map(lock => lock.name)
    .filter((name): name is string => Boolean(name?.startsWith(LOCK_PREFIX)))
    .map(name => name.slice(LOCK_PREFIX.length)));
}
