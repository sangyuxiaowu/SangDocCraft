// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { OpenedDocument } from './documentFileOperations';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { getRegisteredThemes } from '../themes/themeRegistry';
const { invoke, isTauriEnvironment, confirm, storeDocumentTransfer, deleteDocumentTransfer } = vi.hoisted(() => ({
  invoke: vi.fn(), isTauriEnvironment: vi.fn(() => false), confirm: vi.fn(),
  storeDocumentTransfer: vi.fn(), deleteDocumentTransfer: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('./tauriHelper', () => ({ isTauriEnvironment }));
vi.mock('./modalDialog', () => ({ modal: { confirm } }));
vi.mock('./browserDocumentStore', () => ({ storeDocumentTransfer, deleteDocumentTransfer }));
import { openDocumentWindow, sendDocumentToWindow } from './documentWindows';

const opened: OpenedDocument = { document: {
  id: 'document', title: 'Test', createdAt: '', modifiedAt: '', markdown: '# Test',
  meta: DEFAULT_DOCUMENT_META, theme: getRegisteredThemes()[0],
  settings: { historyEnabled: false, historyIdleMinutes: 10 }, history: [], chatSessions: [], assets: [],
} };

beforeEach(() => {
  confirm.mockReset().mockResolvedValue(true);
  storeDocumentTransfer.mockReset().mockResolvedValue('transfer-id');
  deleteDocumentTransfer.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  isTauriEnvironment.mockReturnValue(false);
  invoke.mockReset();
});

it('reserves the browser tab synchronously and navigates to an encoded document request', async () => {
  const replace = vi.fn();
  const child = { closed: false, location: { replace }, close: vi.fn() };
  const open = vi.fn(() => child);
  vi.stubGlobal('open', open);
  const opening = openDocumentWindow({ kind: 'recent', id: 'file & other' });
  expect(open).toHaveBeenCalledWith('about:blank', '_blank');
  await opening;
  expect(new URL(replace.mock.calls[0][0]).searchParams.get('id')).toBe('file & other');
});

it('reports blocked windows instead of replacing the current page', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  await expect(openDocumentWindow({ kind: 'draft', id: 'draft' })).rejects.toThrow('拦截');
});

it('uses a native document window rather than a browser popup in Tauri', async () => {
  isTauriEnvironment.mockReturnValue(true);
  const open = vi.spyOn(window, 'open');
  await openDocumentWindow({ kind: 'template', id: 'blank' });
  expect(invoke).toHaveBeenCalledWith('open_document_window', { query: '?document=template&id=blank' });
  expect(open).not.toHaveBeenCalled();
});

it.each(['held', 'pending'])('rejects a document with a %s session before creating a window or transfer', async (state) => {
  vi.stubGlobal('navigator', {
    locks: { query: vi.fn().mockResolvedValue({ [state]: [{ name: 'sangdoccraft-document:document' }] }) },
  });
  const open = vi.spyOn(window, 'open');
  await expect(sendDocumentToWindow(opened)).rejects.toThrow('另一个窗口');
  expect(open).not.toHaveBeenCalled();
  expect(storeDocumentTransfer).not.toHaveBeenCalled();
});

it('prepares transfer storage before opening the new window', async () => {
  let finishStore!: (id: string) => void;
  storeDocumentTransfer.mockImplementation(() => new Promise<string>(resolve => { finishStore = resolve; }));
  const replace = vi.fn();
  const open = vi.fn(() => ({ closed: false, close: vi.fn(), location: { replace } }));
  vi.stubGlobal('open', open);
  const sending = sendDocumentToWindow(opened);
  await vi.waitFor(() => expect(storeDocumentTransfer).toHaveBeenCalledOnce());
  expect(open).not.toHaveBeenCalled();
  finishStore('ready');
  await sending;
  expect(open).toHaveBeenCalledOnce();
  expect(new URL(replace.mock.calls[0][0]).searchParams.get('id')).toBe('ready');
  expect(deleteDocumentTransfer).not.toHaveBeenCalled();
});

it('reports storage failures before opening a window', async () => {
  storeDocumentTransfer.mockRejectedValue(new Error('Storage unavailable'));
  const open = vi.spyOn(window, 'open');
  await expect(sendDocumentToWindow(opened)).rejects.toThrow('Storage unavailable');
  expect(open).not.toHaveBeenCalled();
});

it.each([true, false])('waits for a fresh click after slow preparation (continue: %s)', async (proceed) => {
  const activation = { isActive: false };
  vi.stubGlobal('navigator', { userActivation: activation });
  let finishConfirm!: (value: boolean) => void;
  confirm.mockImplementation(() => new Promise<boolean>(resolve => { finishConfirm = resolve; }));
  const open = vi.fn(() => {
    expect(activation.isActive).toBe(true);
    return { closed: false, close: vi.fn(), location: { replace: vi.fn() } };
  });
  vi.stubGlobal('open', open);
  const sending = sendDocumentToWindow(opened);
  await vi.waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmText: '继续打开' })));
  expect(open).not.toHaveBeenCalled();
  activation.isActive = true;
  finishConfirm(proceed);
  await sending;
  expect(open).toHaveBeenCalledTimes(proceed ? 1 : 0);
  expect(deleteDocumentTransfer).toHaveBeenCalledTimes(proceed ? 0 : 1);
});

it('cleans up prepared data when the browser blocks the new window', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  await expect(sendDocumentToWindow(opened)).rejects.toThrow('拦截');
  expect(deleteDocumentTransfer).toHaveBeenCalledWith('transfer-id');
});
