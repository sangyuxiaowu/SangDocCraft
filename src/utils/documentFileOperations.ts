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

export async function readSangDocumentFile(file: File): Promise<OpenedDocument> {
  return { document: await unpackSangDocument(new Uint8Array(await file.arrayBuffer())) };
}

export async function openSangDocument(): Promise<OpenedDocument | undefined> {
  if (!isTauriEnvironment()) return undefined;
  const file = await invoke<NativeDocumentFile | null>('open_sdc_document');
  if (!file) return undefined;
  return { document: await unpackSangDocument(Uint8Array.from(file.bytes)), path: file.path };
}

export async function readStartupDocument(): Promise<OpenedDocument | undefined> {
  if (!isTauriEnvironment()) return undefined;
  const file = await invoke<NativeDocumentFile | null>('take_startup_document');
  if (!file) return undefined;
  return { document: await unpackSangDocument(Uint8Array.from(file.bytes)), path: file.path };
}

function downloadDocument(data: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: SANG_DOCUMENT_MIME_TYPE }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function saveSangDocument(document: SangDocument, path?: string): Promise<string | undefined> {
  const bytes = packSangDocument(document);
  const suggestedName = `${document.title.replace(/[<>:"/\\|?*]+/g, '-').trim() || '未命名文档'}.sdc`;
  if (!isTauriEnvironment()) {
    downloadDocument(bytes, suggestedName);
    return path || suggestedName;
  }
  return (await invoke<string | null>('save_sdc_document', {
    request: { path, suggestedName, bytes: Array.from(bytes) },
  })) || undefined;
}