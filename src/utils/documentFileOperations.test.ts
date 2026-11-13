// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SangDocument } from '../types';

const { invoke, isTauriEnvironment, packSangDocument } = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauriEnvironment: vi.fn(),
  packSangDocument: vi.fn(() => new Uint8Array([1, 2, 3])),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('./tauriHelper', () => ({ isTauriEnvironment }));
vi.mock('./documentPackage', async (importOriginal) => ({
  ...await importOriginal<typeof import('./documentPackage')>(),
  packSangDocument,
}));

import { downloadSangDocument, ensureFilePermission, getDocumentSaveErrorMessage, openSangDocument, pickBrowserSaveFile, saveSangDocument, writeBrowserDocument } from './documentFileOperations';
import type { DocumentFileHandle } from './browserDocumentStore';
import { getRegisteredThemes } from '../themes/themeRegistry';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';

function createDocument(): SangDocument {
  return {
    id: 'doc-test',
    title: '测试文档',
    createdAt: '2026-09-15T00:00:00.000Z',
    modifiedAt: '2026-09-15T00:00:00.000Z',
    markdown: '# 测试',
    meta: DEFAULT_DOCUMENT_META,
    theme: getRegisteredThemes()[0],
    settings: { historyEnabled: false, historyIdleMinutes: 10 },
    history: [],
    chatSessions: [],
    assets: [],
  };
}

describe('document file operations', () => {
  const createHandle = () => ({
    name: 'local.sdc',
    getFile: vi.fn(),
    isSameEntry: vi.fn(),
    queryPermission: vi.fn<DocumentFileHandle['queryPermission']>().mockResolvedValue('granted'),
    requestPermission: vi.fn<DocumentFileHandle['requestPermission']>().mockResolvedValue('granted'),
    createWritable: vi.fn<DocumentFileHandle['createWritable']>(),
  });

  it('writes the document package to the opened handle and waits for close', async () => {
    const handle = createHandle();
    const stream = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), abort: vi.fn() };
    handle.createWritable.mockResolvedValue(stream);
    await writeBrowserDocument(createDocument(), handle);
    expect(stream.write).toHaveBeenCalledWith(expect.any(Blob));
    expect(stream.close).toHaveBeenCalledOnce();
    expect(stream.abort).not.toHaveBeenCalled();
  });

  it('surfaces write failures without reporting success and aborts the partial write', async () => {
    const handle = createHandle();
    const stream = { write: vi.fn().mockRejectedValue(new Error('disk full')), close: vi.fn(), abort: vi.fn().mockResolvedValue(undefined) };
    handle.createWritable.mockResolvedValue(stream);
    await expect(writeBrowserDocument(createDocument(), handle)).rejects.toThrow('disk full');
    expect(stream.close).not.toHaveBeenCalled();
    expect(stream.abort).toHaveBeenCalledOnce();
  });

  it('requests permission only for an explicit save, never during auto-save', async () => {
    const handle = createHandle();
    handle.queryPermission.mockResolvedValue('prompt');
    await expect(ensureFilePermission(handle, 'readwrite', false)).rejects.toThrow('写入权限');
    expect(handle.requestPermission).not.toHaveBeenCalled();
    await ensureFilePermission(handle, 'readwrite');
    expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    handle.requestPermission.mockResolvedValue('denied');
    await expect(ensureFilePermission(handle, 'readwrite')).rejects.toThrow('写入权限');
  });

  it('treats picker cancellation as cancellation but propagates permission failures', async () => {
    const picker = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    vi.stubGlobal('showOpenFilePicker', picker);
    vi.stubGlobal('showSaveFilePicker', picker);
    try {
      await expect(openSangDocument()).resolves.toBeUndefined();
      await expect(pickBrowserSaveFile('test')).resolves.toBeUndefined();
      picker.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
      await expect(openSangDocument()).rejects.toThrow('denied');
      await expect(pickBrowserSaveFile('test')).rejects.toThrow('denied');
    } finally { vi.unstubAllGlobals(); }
  });

  it('preserves native string errors and unknown error details', () => {
    expect(getDocumentSaveErrorMessage('拒绝访问。 (os error 5)')).toBe('拒绝访问。 (os error 5)');
    expect(getDocumentSaveErrorMessage(new Error('disk full'))).toBe('disk full');
    expect(getDocumentSaveErrorMessage({ code: 'io_error', message: 'disk full' })).toBe('disk full');
    expect(getDocumentSaveErrorMessage(null)).toContain('另存为');
  });

  it('distinguishes read-only files, permission errors and file locks', () => {
    expect(getDocumentSaveErrorMessage({ code: 'read_only', message: 'denied' })).toContain('文件为只读');
    expect(getDocumentSaveErrorMessage({ code: 'permission_denied', message: 'denied' })).toContain('没有写入权限');
    expect(getDocumentSaveErrorMessage({ code: 'file_in_use', message: 'denied' })).toContain('其他程序占用');
  });

  beforeEach(() => {
    invoke.mockReset();
    isTauriEnvironment.mockReset();
    packSangDocument.mockClear();
  });

  it('does not download or invoke native save in a web environment', async () => {
    isTauriEnvironment.mockReturnValue(false);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await expect(saveSangDocument(createDocument())).resolves.toBeUndefined();

    expect(click).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(packSangDocument).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('downloads only when explicitly requested', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    downloadSangDocument(createDocument());

    expect(click).toHaveBeenCalledOnce();
    expect(packSangDocument).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    click.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
