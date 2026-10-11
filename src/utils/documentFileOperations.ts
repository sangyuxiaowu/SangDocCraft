import { invoke } from '@tauri-apps/api/core';
import type { SangDocument } from '../types';
import { packSangDocument, SANG_DOCUMENT_MIME_TYPE, unpackSangDocument } from './documentPackage';
import { isTauriEnvironment } from './tauriHelper';

interface NativeDocumentFile {
  path: string;
  bytes: number[];
}

export interface OpenedDocument {
  document: SangDocument;
  path?: string;
}

export function getDocumentSaveErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const messages: Record<string, string> = {
      read_only: '文件为只读，无法保存修改。请取消文件的只读属性后重试，或另存为新文件。',
      permission_denied: '没有写入权限。请检查文件或文件夹权限，或另存到其他位置。',
      file_in_use: '文件正被其他程序占用。请关闭占用程序后重试，或另存为新文件。',
    };
    if (typeof error.code === 'string' && messages[error.code]) return messages[error.code];
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '保存文档失败，请重试或另存为新文件。';
}

export async function readSangDocumentFile(file: File): Promise<OpenedDocument> {
  return { document: await unpackSangDocument(new Uint8Array(await file.arrayBuffer())) };
}

export async function openSangDocument(): Promise<OpenedDocument | undefined> {
  if (!isTauriEnvironment()) return undefined;
  const file = await invoke<NativeDocumentFile | null>('open_sdc_document');
  if (!file) return undefined;
  return { document: await unpackSangDocument(Uint8Array.from(file.bytes)), path: file.path };
}

export async function openSangDocumentByPath(path: string): Promise<OpenedDocument | undefined> {
  if (!isTauriEnvironment() || !path) return undefined;
  const file = await invoke<NativeDocumentFile | null>('open_sdc_document_by_path', { path });
  if (!file) return undefined;
  return { document: await unpackSangDocument(Uint8Array.from(file.bytes)), path: file.path };
}

export async function readStartupDocument(): Promise<OpenedDocument | undefined> {
  if (!isTauriEnvironment()) return undefined;
  const file = await invoke<NativeDocumentFile | null>('take_startup_document');
  if (!file) return undefined;
  return { document: await unpackSangDocument(Uint8Array.from(file.bytes)), path: file.path };
}

function getSuggestedFileName(document: SangDocument): string {
  return `${document.title.replace(/[<>:"/\\|?*]+/g, '-').trim() || '未命名文档'}.sdc`;
}

export function downloadSangDocument(sangDocument: SangDocument): void {
  const data = packSangDocument(sangDocument);
  const fileName = getSuggestedFileName(sangDocument);
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: SANG_DOCUMENT_MIME_TYPE }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function saveSangDocument(document: SangDocument, path?: string): Promise<string | undefined> {
  if (!isTauriEnvironment()) return undefined;
  const bytes = packSangDocument(document);
  const suggestedName = getSuggestedFileName(document);
  return (await invoke<string | null>('save_sdc_document', {
    request: { path, suggestedName, bytes: Array.from(bytes) },
  })) || undefined;
}