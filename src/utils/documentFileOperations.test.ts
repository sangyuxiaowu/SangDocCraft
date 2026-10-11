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

import { downloadSangDocument, getDocumentSaveErrorMessage, saveSangDocument } from './documentFileOperations';
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
