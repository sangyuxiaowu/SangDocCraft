import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment } from './tauriHelper';
import { deleteDocumentTransfer, storeDocumentTransfer } from './browserDocumentStore';
import type { OpenedDocument } from './documentFileOperations';
import { assertDocumentSessionAvailable } from './documentSession';
import { modal } from './modalDialog';

export type DocumentWindowRequest =
  | { kind: 'template'; id: string }
  | { kind: 'draft'; id: string }
  | { kind: 'recent'; id: string }
  | { kind: 'transfer'; id: string };

export function getDocumentWindowRequest(): DocumentWindowRequest | undefined {
  const params = new URLSearchParams(window.location.search);
  const kind = params.get('document');
  const id = params.get('id');
  if (!id) return undefined;
  if (kind === 'template' || kind === 'draft' || kind === 'recent' || kind === 'transfer') return { kind, id };
  throw new Error('无法识别文档打开请求。');
}

function documentUrl(request: DocumentWindowRequest): URL {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ document: request.kind, id: request.id }).toString();
  url.hash = '';
  return url;
}

export function reserveDocumentWindow() {
  const native = isTauriEnvironment();
  const target = native ? undefined : window.open('about:blank', '_blank');
  if (!native && !target) throw new Error('新窗口被浏览器拦截，请允许此站点弹出窗口后重试。当前文档未被替换。');
  return {
    close: () => target?.close(),
    async open(request: DocumentWindowRequest) {
      const url = documentUrl(request);
      if (native) {
        await invoke('open_document_window', { query: url.search });
      } else if (target && !target.closed) {
        target.location.replace(url.href);
      } else {
        throw new Error('新文档窗口已关闭，请重新打开。');
      }
    },
  };
}

export async function openDocumentWindow(request: DocumentWindowRequest): Promise<boolean> {
  // 异步校验可能超过用户激活的有效期；用明确的点击继续，而不是先弹出空白页。
  if (!isTauriEnvironment() && navigator.userActivation?.isActive === false) {
    const confirmed = await modal.confirm({
      title: '文档已准备就绪',
      message: '点击“继续打开”，在新窗口中编辑文档。当前文档会保留。',
      confirmText: '继续打开',
      cancelText: '取消',
    });
    if (!confirmed) return false;
  }
  const target = reserveDocumentWindow();
  try {
    await target.open(request);
    return true;
  }
  catch (error) { target.close(); throw error; }
}

export async function sendDocumentToWindow(opened: OpenedDocument): Promise<void> {
  await assertDocumentSessionAvailable(opened.document.id);
  const id = await storeDocumentTransfer(opened);
  let didOpen = false;
  try {
    didOpen = await openDocumentWindow({ kind: 'transfer', id });
  } finally {
    if (!didOpen) {
      try { await deleteDocumentTransfer(id); }
      catch (cleanupError) { console.error('Document transfer cleanup failed:', cleanupError); }
    }
  }
}
