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

import { downloadSangDocument, saveSangDocument } from './documentFileOperations';
import { getRegisteredThemes } from '../themes/themeRegistry';

function createDocument(): SangDocument {
  return {
    id: 'doc-test',
    title: '测试文档',
    createdAt: '2026-09-15T00:00:00.000Z',
    modifiedAt: '2026-09-15T00:00:00.000Z',
    markdown: '# 测试',
    theme: getRegisteredThemes()[0],
    settings: { historyEnabled: false, historyIdleMinutes: 10 },
    history: [],
    chatSessions: [],
    assets: [],
  };
}

describe('document file operations', () => {
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
