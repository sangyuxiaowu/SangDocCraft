import type { SangDocument } from '../types';
import { unpackSangDocument } from './documentPackage';

export type DocumentPackageResult =
  | { ok: true; document: SangDocument }
  | { ok: false; message: string };

self.onmessage = async (event: MessageEvent<Uint8Array>) => {
  try {
    const document = await unpackSangDocument(event.data);
    const buffers = [...new Set(document.assets.map(asset => asset.data.buffer))]
      .filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
    self.postMessage({ ok: true, document } satisfies DocumentPackageResult, { transfer: buffers });
  } catch (error) {
    self.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : '文档解析失败，请检查文件后重试。',
    } satisfies DocumentPackageResult);
  }
};
