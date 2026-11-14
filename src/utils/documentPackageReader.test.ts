// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { getRegisteredThemes } from '../themes/themeRegistry';
import type { SangDocument } from '../types';
import type { DocumentPackageResult } from './documentPackage.worker';
import { readDocumentPackage } from './documentPackageReader';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent<DocumentPackageResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  constructor() { TestWorker.instances.push(this); }
}

const document: SangDocument = {
  id: 'worker-document', title: 'Worker document', createdAt: '', modifiedAt: '',
  markdown: '# Worker document', meta: DEFAULT_DOCUMENT_META, theme: getRegisteredThemes()[0],
  settings: { historyEnabled: false, historyIdleMinutes: 10 }, history: [], chatSessions: [], assets: [],
};

beforeEach(() => {
  TestWorker.instances = [];
  vi.stubGlobal('Worker', TestWorker);
});

afterEach(() => { vi.unstubAllGlobals(); });

it('transfers package bytes to a worker and waits for its parsed document', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const reading = readDocumentPackage(bytes);
  const worker = TestWorker.instances[0];
  expect(worker.postMessage).toHaveBeenCalledWith(bytes, [bytes.buffer]);
  expect(worker.terminate).not.toHaveBeenCalled();
  worker.onmessage!(new MessageEvent('message', { data: { ok: true, document } }));
  await expect(reading).resolves.toBe(document);
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it.each(['decode', 'runtime', 'message'])('surfaces %s failures and terminates the worker', async (failure) => {
  const reading = readDocumentPackage(new Uint8Array([1]));
  const worker = TestWorker.instances[0];
  if (failure === 'decode') {
    worker.onmessage!(new MessageEvent('message', { data: { ok: false, message: '图片校验失败' } }));
  } else if (failure === 'runtime') {
    worker.onerror!(new ErrorEvent('error', { message: 'Worker failed to load' }));
  } else {
    worker.onmessageerror!();
  }
  await expect(reading).rejects.toThrow(failure === 'decode' ? '图片校验失败' : failure === 'runtime' ? 'Worker failed to load' : '无法接收');
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('terminates on transfer failure and allows a later open to use a fresh worker', async () => {
  class FailedTransferWorker extends TestWorker {
    postMessage = vi.fn(() => { throw new Error('Transfer failed'); });
  }
  vi.stubGlobal('Worker', FailedTransferWorker);
  await expect(readDocumentPackage(new Uint8Array([1]))).rejects.toThrow('Transfer failed');
  expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
  vi.stubGlobal('Worker', TestWorker);
  const reading = readDocumentPackage(new Uint8Array([2]));
  const worker = TestWorker.instances[1];
  worker.onmessage!(new MessageEvent('message', { data: { ok: true, document } }));
  await expect(reading).resolves.toBe(document);
  expect(worker.terminate).toHaveBeenCalledOnce();
});
