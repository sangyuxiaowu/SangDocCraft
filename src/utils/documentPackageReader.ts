import type { SangDocument } from '../types';
import type { DocumentPackageResult } from './documentPackage.worker';

export function readDocumentPackage(data: Uint8Array<ArrayBuffer>): Promise<SangDocument> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./documentPackage.worker.ts', import.meta.url), { type: 'module' });
    const fail = (error: unknown) => {
      worker.terminate();
      reject(error);
    };
    worker.onmessage = (event: MessageEvent<DocumentPackageResult>) => {
      worker.terminate();
      if (event.data.ok === true) resolve(event.data.document);
      else reject(new Error(event.data.message));
    };
    worker.onerror = (event) => fail(new Error(event.message || '文档解析工作线程异常，请重试。'));
    worker.onmessageerror = () => fail(new Error('无法接收解析后的文档，请重试。'));
    try {
      // 输入仅用于本次打开；转移字节缓冲区，避免在主线程复制大文件。
      worker.postMessage(data, [data.buffer]);
    } catch (error) {
      fail(error);
    }
  });
}
