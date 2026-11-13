// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest';
const { invoke, isTauriEnvironment } = vi.hoisted(() => ({ invoke: vi.fn(), isTauriEnvironment: vi.fn(() => false) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('./tauriHelper', () => ({ isTauriEnvironment }));
import { openDocumentWindow } from './documentWindows';

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
