// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_TEMPLATES } from './data/documentTemplates';
import { createDiffHunks } from './utils/diffUtils';
import type { DocumentAsset, DocumentTheme, SangDocument } from './types';
import type { AiToolContext } from './utils/aiAssistantService';
import App from './App';
import { DEFAULT_DOCUMENT_META } from './data/defaultDocumentMeta';
import { getRegisteredThemes } from './themes/themeRegistry';
import type { WelcomeDashboard } from './components/WelcomeDashboard';
import type { HeaderBar } from './components/HeaderBar';
import type { DocumentFileHandle } from './utils/browserDocumentStore';

const { saveDraft, saveSangDocument, openSangDocument, pickBrowserDocumentFile, supportsBrowserFilePicker, readBrowserDocument, writeBrowserDocument, ensureFilePermission, rememberBrowserFile, openDocumentWindow, reserveDocumentWindow, sendDocumentToWindow, listChatSessions, listLibraryAssets, isTauriEnvironment, confirm, alert } = vi.hoisted(() => ({
  saveDraft: vi.fn(),
  saveSangDocument: vi.fn(),
  openSangDocument: vi.fn<typeof import('./utils/documentFileOperations').openSangDocument>(),
  pickBrowserDocumentFile: vi.fn<() => Promise<DocumentFileHandle | undefined>>(),
  supportsBrowserFilePicker: vi.fn(() => true),
  readBrowserDocument: vi.fn(),
  writeBrowserDocument: vi.fn(),
  ensureFilePermission: vi.fn(),
  rememberBrowserFile: vi.fn(),
  openDocumentWindow: vi.fn(),
  reserveDocumentWindow: vi.fn(),
  sendDocumentToWindow: vi.fn(),
  listChatSessions: vi.fn(),
  listLibraryAssets: vi.fn(),
  isTauriEnvironment: vi.fn(() => false),
  confirm: vi.fn(async () => false),
  alert: vi.fn(async () => {}),
}));

vi.mock('./utils/draftStore', async (importOriginal) => ({
  ...await importOriginal<typeof import('./utils/draftStore')>(),
  saveDraft,
  deleteDraft: async () => {},
  getUnsavedDraftSummaries: async () => [],
  runStorageGC: async () => {},
}));
vi.mock('./utils/documentFileOperations', () => ({
  readStartupDocument: async () => undefined,
  openSangDocument,
  pickBrowserDocumentFile,
  supportsBrowserFilePicker,
  readBrowserDocument,
  writeBrowserDocument,
  ensureFilePermission,
  supportsBrowserSavePicker: () => false,
  saveSangDocument,
  getDocumentSaveErrorMessage: (error: unknown) => typeof error === 'string' ? error : '文件为只读',
}));
vi.mock('./utils/browserDocumentStore', () => ({ rememberBrowserFile }));
vi.mock('./utils/documentWindows', () => ({
  getDocumentWindowRequest: () => undefined,
  openDocumentWindow,
  reserveDocumentWindow,
  sendDocumentToWindow,
}));
vi.mock('./utils/tauriHelper', async (importOriginal) => ({
  ...await importOriginal<typeof import('./utils/tauriHelper')>(),
  isTauriEnvironment,
  updateTauriWindowTitle: async () => {},
}));
vi.mock('./lib/aiConfig', () => ({
  loadAiConfig: () => ({ endpoints: [], activeSelection: {} }),
  loadAiConfigWithSecrets: async () => ({ endpoints: [], activeSelection: {} }),
}));
vi.mock('./utils/imageRepository', () => ({
  clearDocumentChatSessions: async () => {},
  listDocumentAssets: async () => [],
  listLibraryAssets,
  listChatSessions,
  putChatSession: async () => {},
  putDocumentAsset: async () => {},
  putLibraryAsset: async () => {},
}));
vi.mock('./components/HeaderBar', () => ({
  HeaderBar: ({ onSaveDocument, onSaveAs, onOpenWelcome, saveError }: ComponentProps<typeof HeaderBar>) => (
    <><button onClick={onSaveDocument}>保存</button><button onClick={onSaveAs}>另存为</button><button onClick={onOpenWelcome}>返回欢迎页</button><span data-testid="save-error">{saveError}</span></>
  ),
}));
vi.mock('./utils/modalDialog', () => ({ modal: { confirm, alert } }));
vi.mock('./components/Editor', () => ({
  Editor: ({ value, onChange, saveStatus, reviewSession, onRejectAllHunks, onApplyResolution }: {
    value: string;
    onChange: (value: string) => void;
    saveStatus: string;
    reviewSession?: unknown;
    onRejectAllHunks: () => void;
    onApplyResolution: () => void;
  }) => (
    <>
      <button onClick={() => onChange('first')}>第一次编辑</button>
      <button onClick={() => onChange('second')}>第二次编辑</button>
      <output>{saveStatus}</output><output data-testid="body">{value}</output>
      {reviewSession && <><button onClick={onRejectAllHunks}>全部拒绝</button><button onClick={onApplyResolution}>应用审查</button></>}
    </>
  ),
}));
vi.mock('./components/A4Preview', () => ({ A4Preview: ({ theme }: { theme: DocumentTheme }) => <output data-testid="cover-logo">{theme.cover.logoUrl}</output> }));
vi.mock('./components/styleConfig/Panel', () => ({ StyleConfigPanel: ({ theme, onChange }: { theme: DocumentTheme; onChange: (theme: DocumentTheme) => void }) => (
  <button onClick={() => onChange({ ...theme, cover: { ...theme.cover, logoUrl: '@library/img-12eecd3f64fb38a4998a013b' } })}>设置封面图片</button>
) }));
vi.mock('./components/WelcomeDashboard', () => ({
  WelcomeDashboard: ({ onSelectTemplate, onOpenLocalFile, isOpen, currentDocument, onClose }: ComponentProps<typeof WelcomeDashboard>) => (
    <>
      <button onClick={() => onSelectTemplate(DOCUMENT_TEMPLATES[0])}>新建</button>
      {isOpen && <button onClick={onOpenLocalFile}>打开 .sdc 文档</button>}
      {isOpen && currentDocument && (
        <section aria-label="当前打开的文档">
          {currentDocument.title}
          {currentDocument.hasUnsavedChanges && <span>有未保存修改</span>}
          <button onClick={onClose}>继续编辑</button>
        </section>
      )}
    </>
  ),
}));
vi.mock('./components/ai/AiAssistantFloat', () => ({
  AiAssistantFloat: ({ toolContext }: { toolContext: AiToolContext }) => (
    <button onClick={() => { void toolContext.onStartDiffReview({
      id: 'review', originalText: 'first', modifiedText: 'second',
      hunks: createDiffHunks('first', 'second'), createdAt: new Date().toISOString(),
    }); }}>开始审查</button>
  ),
}));
vi.mock('./components/ai/AiSettingsModal', () => ({ AiSettingsModal: () => null }));
vi.mock('./components/ModalDialogContainer', () => ({ ModalDialogContainer: () => null }));
vi.mock('./components/DocumentHistoryModal', () => ({ DocumentHistoryModal: () => null }));
vi.mock('./components/ImageManager', () => ({ ImageManager: () => null }));
vi.mock('./components/JsonThemeModal', () => ({ JsonThemeModal: () => null }));
vi.mock('./components/AboutModal', () => ({ AboutModal: () => null }));
vi.mock('./components/PrintPdfModal', () => ({ PrintPdfModal: () => null }));

describe('document saving', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const pendingSaves: Array<() => void> = [];
  const pickedHandle: DocumentFileHandle = {
    name: 'picked.sdc', getFile: vi.fn(), isSameEntry: vi.fn(),
    queryPermission: vi.fn(), requestPermission: vi.fn(), createWritable: vi.fn(),
  };
  const pickedDocument: SangDocument = {
    id: 'picked-document', title: 'Picked document',
    createdAt: '2026-01-01T00:00:00.000Z', modifiedAt: '2026-01-01T00:00:00.000Z',
    markdown: '# Picked document', meta: DEFAULT_DOCUMENT_META, theme: getRegisteredThemes()[0],
    settings: { historyEnabled: false, historyIdleMinutes: 10 }, history: [], chatSessions: [], assets: [],
  };
  const click = (text: string) => [...container.querySelectorAll('button')].find((button) => button.textContent === text)!.click();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    confirm.mockReset().mockResolvedValue(false);
    isTauriEnvironment.mockReturnValue(false);
    listChatSessions.mockResolvedValue([]);
    listLibraryAssets.mockResolvedValue([]);
    readBrowserDocument.mockReset();
    openSangDocument.mockReset().mockResolvedValue(undefined);
    pickBrowserDocumentFile.mockReset().mockResolvedValue(undefined);
    supportsBrowserFilePicker.mockReturnValue(true);
    reserveDocumentWindow.mockReset().mockImplementation(() => ({ close: vi.fn(), open: vi.fn() }));
    writeBrowserDocument.mockReset().mockResolvedValue(undefined);
    ensureFilePermission.mockReset().mockResolvedValue(undefined);
    openDocumentWindow.mockReset().mockResolvedValue(undefined);
    sendDocumentToWindow.mockReset().mockResolvedValue(undefined);
    saveSangDocument.mockResolvedValue('document.sdc');
    saveDraft.mockImplementation(() => new Promise<void>((resolve) => pendingSaves.push(resolve)));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    pendingSaves.length = 0;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('does not clear newer edits when an older auto-save completes', async () => {
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(pendingSaves).toHaveLength(1);

    await act(async () => { click('第二次编辑'); });
    await act(async () => { pendingSaves[0](); });
    expect(container.querySelector('output')?.textContent).toBe('unsaved');

    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(pendingSaves).toHaveLength(2);
    await act(async () => { pendingSaves[1](); });
    expect(container.querySelector('output')?.textContent).toBe('saved');
  });

  it('resolves a cover logo when library assets arrive after the document', async () => {
    let finishAssets!: (assets: DocumentAsset[]) => void;
    listLibraryAssets.mockImplementation(() => new Promise<DocumentAsset[]>((resolve) => { finishAssets = resolve; }));
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/cover-logo');
    try {
      await act(async () => { root.render(<App />); });
      await act(async () => { click('新建'); });
      await act(async () => { click('设置封面图片'); });
      expect(container.querySelector('[data-testid="cover-logo"]')?.textContent).toBe('@library/img-12eecd3f64fb38a4998a013b');

      await act(async () => { finishAssets([{
        id: 'img-12eecd3f64fb38a4998a013b', scope: 'library', fileName: 'logo.png', description: '',
        mediaType: 'image/png', byteLength: 1, sha256: '', data: new Uint8Array([0]),
      }]); });
      expect(container.querySelector('[data-testid="cover-logo"]')?.textContent).toBe('blob:http://localhost/cover-logo');
    } finally {
      createObjectURL.mockRestore();
    }
  });

  it('opens an .sdc file delivered through the PWA launch queue', async () => {
    let consumeLaunch!: (params: { files?: Array<{ getFile: () => Promise<File> }> }) => Promise<void>;
    const file = new File(['sdc'], 'launched.sdc');
    const sangDocument: SangDocument = {
      id: 'pwa-document',
      title: 'PWA 文档',
      createdAt: '2026-01-01T00:00:00.000Z',
      modifiedAt: '2026-01-01T00:00:00.000Z',
      markdown: '# 从 PWA 打开',
      meta: { ...DEFAULT_DOCUMENT_META, title: 'PWA 文档' },
      theme: getRegisteredThemes()[0],
      settings: { historyEnabled: false, historyIdleMinutes: 10 },
      history: [],
      chatSessions: [],
      assets: [],
    };
    const handle = { name: file.name, getFile: async () => file };
    const browserFile = { id: 'local-file', handle };
    rememberBrowserFile.mockResolvedValue(browserFile);
    readBrowserDocument.mockResolvedValue({ document: sangDocument, browserFile });
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: { setConsumer: (consumer: typeof consumeLaunch) => { consumeLaunch = consumer; } },
    });

    try {
      await act(async () => { root.render(<App />); });
      await act(async () => {
        await consumeLaunch({ files: [handle] });
      });

      expect(readBrowserDocument).toHaveBeenCalledWith(handle);
      expect(container.querySelector('[data-testid="body"]')?.textContent).toBe('# 从 PWA 打开');

      await act(async () => { click('第一次编辑'); });
      await act(async () => { click('保存'); });
      expect(writeBrowserDocument).toHaveBeenLastCalledWith(expect.objectContaining({ markdown: 'first' }), handle);
      expect(saveDraft).not.toHaveBeenCalled();

      await act(async () => { click('第二次编辑'); });
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(ensureFilePermission).toHaveBeenLastCalledWith(handle, 'readwrite', false);
      expect(writeBrowserDocument).toHaveBeenLastCalledWith(expect.objectContaining({ markdown: 'second' }), handle);

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        writeBrowserDocument.mockRejectedValueOnce('没有写入权限');
        await act(async () => { click('第一次编辑'); });
        await act(async () => { vi.advanceTimersByTime(1500); });
        expect(container.querySelector('output')?.textContent).toBe('unsaved');
        expect(container.querySelector('[data-testid="save-error"]')?.textContent).toBe('没有写入权限');
        expect(saveDraft).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }

      await act(async () => {
        await consumeLaunch({ files: [handle, handle] });
      });
      expect(sendDocumentToWindow).toHaveBeenCalledTimes(2);
      expect(container.querySelector('[data-testid="body"]')?.textContent).toBe('first');
      expect(confirm).not.toHaveBeenCalled();
    } finally {
      delete (window as Window & { launchQueue?: unknown }).launchQueue;
    }
  });

  it('writes newer revisions after the older write finishes', async () => {
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await act(async () => { click('第二次编辑'); });
    await act(async () => { vi.advanceTimersByTime(1500); });

    expect(saveDraft).toHaveBeenCalledTimes(1);
    await act(async () => { pendingSaves[0](); });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft.mock.calls[1][0].markdown).toBe('second');
    await act(async () => { pendingSaves[1](); });
    expect(container.querySelector('output')?.textContent).toBe('saved');
  });

  it('does not clear newer edits when a manual save completes', async () => {
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { click('保存'); });
    expect(pendingSaves).toHaveLength(1);

    await act(async () => { click('第二次编辑'); });
    await act(async () => { pendingSaves[0](); });
    expect(container.querySelector('output')?.textContent).toBe('unsaved');
  });

  it('opens a new document in another window without replacing unsaved edits or cancelling their save', async () => {
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { click('保存'); });

    await act(async () => { click('新建'); });
    expect(openDocumentWindow).toHaveBeenCalledWith({ kind: 'template', id: DOCUMENT_TEMPLATES[0].id });
    expect(container.querySelector('[data-testid="body"]')?.textContent).toBe('first');
    expect(confirm).not.toHaveBeenCalled();
    await act(async () => { click('第二次编辑'); });
    await act(async () => { pendingSaves[0](); });
    expect(container.querySelector('output')?.textContent).toBe('unsaved');
  });

  it('shows the active document on the welcome page and resumes its existing unsaved editor', async () => {
    await act(async () => { root.render(<App />); });
    expect(container.querySelector('[aria-label="当前打开的文档"]')).toBeNull();
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { click('返回欢迎页'); });
    expect(container.querySelector('[aria-label="当前打开的文档"]')?.textContent).toContain('有未保存修改');
    expect(saveDraft).not.toHaveBeenCalled();
    await act(async () => { click('继续编辑'); });
    expect(container.querySelector('[aria-label="当前打开的文档"]')).toBeNull();
    expect(container.querySelector('[data-testid="body"]')?.textContent).toBe('first');
    expect(container.querySelector('output')?.textContent).toBe('unsaved');
    expect(openDocumentWindow).not.toHaveBeenCalled();
  });

  it.each([false, true])('waits for selection before opening one window and reading the file (edited: %s)', async (edited) => {
    const opened = { document: pickedDocument };
    const target = { close: vi.fn(), open: vi.fn() };
    let userActivation = false;
    let finishPick!: (handle: DocumentFileHandle) => void;
    let finishOpen!: (value: typeof opened) => void;
    reserveDocumentWindow.mockImplementation(() => {
      expect(userActivation).toBe(true);
      expect(readBrowserDocument).not.toHaveBeenCalled();
      userActivation = false;
      return target;
    });
    pickBrowserDocumentFile.mockImplementation(() => {
      if (!userActivation) return Promise.reject(new DOMException('Must be handling a user gesture', 'SecurityError'));
      return new Promise((resolve) => { finishPick = resolve; });
    });
    readBrowserDocument.mockImplementation(() => new Promise((resolve) => { finishOpen = resolve; }));

    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    if (edited) await act(async () => { click('第一次编辑'); });
    const previousBody = container.querySelector('[data-testid="body"]')?.textContent;
    await act(async () => { click('返回欢迎页'); });
    await act(async () => {
      userActivation = true;
      click('打开 .sdc 文档');
      userActivation = false;
      expect(pickBrowserDocumentFile).toHaveBeenCalledOnce();
      expect(reserveDocumentWindow).not.toHaveBeenCalled();
    });
    await act(async () => {
      vi.advanceTimersByTime(6000);
      click('打开 .sdc 文档');
    });
    expect(pickBrowserDocumentFile).toHaveBeenCalledOnce();
    expect(reserveDocumentWindow).not.toHaveBeenCalled();
    await act(async () => {
      userActivation = true;
      finishPick(pickedHandle);
    });
    expect(reserveDocumentWindow).toHaveBeenCalledOnce();
    expect(readBrowserDocument).toHaveBeenCalledWith(pickedHandle);
    expect(alert).not.toHaveBeenCalled();
    expect(sendDocumentToWindow).not.toHaveBeenCalled();
    await act(async () => { click('打开 .sdc 文档'); });
    expect(pickBrowserDocumentFile).toHaveBeenCalledOnce();
    await act(async () => { finishOpen(opened); });
    expect(sendDocumentToWindow).toHaveBeenCalledWith(opened, target);
    expect(container.querySelector('[data-testid="body"]')?.textContent).toBe(previousBody);
    expect(target.close).not.toHaveBeenCalled();
  });

  it.each(['cancel', 'failure'])('creates no window on picker %s and allows retry', async (outcome) => {
    if (outcome === 'failure') pickBrowserDocumentFile.mockRejectedValueOnce(new Error('Cannot select document'));
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('返回欢迎页'); });
    await act(async () => { click('打开 .sdc 文档'); });
    expect(reserveDocumentWindow).not.toHaveBeenCalled();
    expect(readBrowserDocument).not.toHaveBeenCalled();
    expect(sendDocumentToWindow).not.toHaveBeenCalled();
    if (outcome === 'failure') {
      expect(alert).toHaveBeenCalledWith(expect.objectContaining({ message: 'Cannot select document', type: 'error' }));
    } else expect(alert).not.toHaveBeenCalled();
    await act(async () => { click('打开 .sdc 文档'); });
    expect(pickBrowserDocumentFile).toHaveBeenCalledTimes(2);
  });

  it.each(['popup', 'read'])('preserves current edits and reports %s failure after selection', async (failure) => {
    const target = { close: vi.fn(), open: vi.fn() };
    pickBrowserDocumentFile.mockResolvedValue(pickedHandle);
    reserveDocumentWindow.mockImplementation(() => {
      if (failure === 'popup') throw new Error('Popup blocked');
      return target;
    });
    readBrowserDocument.mockRejectedValue(new Error('Cannot read document'));
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { click('返回欢迎页'); });
    await act(async () => { click('打开 .sdc 文档'); });
    expect(alert).toHaveBeenCalledWith(expect.objectContaining({ message: failure === 'popup' ? 'Popup blocked' : 'Cannot read document' }));
    if (failure === 'popup') expect(readBrowserDocument).not.toHaveBeenCalled();
    else expect(target.close).toHaveBeenCalledOnce();
    expect(alert).toHaveBeenCalledOnce();
    expect(sendDocumentToWindow).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="body"]')?.textContent).toBe('first');
  });

  it.each([false, true])('opens the first file in the current workspace (native: %s)', async (native) => {
    isTauriEnvironment.mockReturnValue(native);
    pickBrowserDocumentFile.mockResolvedValue(pickedHandle);
    readBrowserDocument.mockResolvedValue({ document: pickedDocument });
    openSangDocument.mockResolvedValue({ document: pickedDocument });
    await act(async () => { root.render(<App />); });
    await act(async () => { click('打开 .sdc 文档'); });
    expect(container.querySelector('[data-testid="body"]')?.textContent).toBe(pickedDocument.markdown);
    expect(reserveDocumentWindow).not.toHaveBeenCalled();
    expect(sendDocumentToWindow).not.toHaveBeenCalled();
    expect(pickBrowserDocumentFile).toHaveBeenCalledTimes(native ? 0 : 1);
    expect(openSangDocument).toHaveBeenCalledTimes(native ? 1 : 0);
  });

  it('keeps the new file path when editing during the first desktop save', async () => {
    isTauriEnvironment.mockReturnValue(true);
    let finishWrite!: (path: string) => void;
    saveSangDocument.mockImplementationOnce(() => new Promise<string>((resolve) => { finishWrite = resolve; }));
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { click('保存'); });
    expect(saveSangDocument).toHaveBeenCalledTimes(1);

    await act(async () => { click('第二次编辑'); });
    await act(async () => { finishWrite('document.sdc'); });
    await act(async () => { vi.advanceTimersByTime(1500); });

    expect(saveSangDocument).toHaveBeenCalledTimes(2);
    expect(saveSangDocument.mock.calls[1][1]).toBe('document.sdc');
    expect(saveSangDocument.mock.calls[1][0].markdown).toBe('second');
  });

  it('writes desktop auto-save before a newer manual save even when the first build is slow', async () => {
    isTauriEnvironment.mockReturnValue(true);
    let finishBuild!: (sessions: []) => void;
    listChatSessions.mockResolvedValueOnce([]).mockImplementationOnce(() => new Promise<[]>(resolve => { finishBuild = resolve; }));
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('保存'); });
    saveSangDocument.mockClear();

    await act(async () => { click('第一次编辑'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    await act(async () => { click('第二次编辑'); });
    await act(async () => { click('保存'); });
    await act(async () => { finishBuild([]); });

    expect(saveSangDocument.mock.calls.map(([document]) => document.markdown)).toEqual(['first', 'second']);
  });

  it('applies the latest AI review decisions', async () => {
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { click('开始审查'); });
    await act(async () => { click('全部拒绝'); });
    await act(async () => { click('应用审查'); });

    expect(container.querySelector('[data-testid="body"]')?.textContent).toBe('first');
  });

  it('offers save as after native save failure and uses the new path for auto-save', async () => {
    isTauriEnvironment.mockReturnValue(true);
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('保存'); });
    await act(async () => { click('第一次编辑'); });
    saveSangDocument.mockRejectedValueOnce('拒绝访问。 (os error 5)').mockResolvedValueOnce('copy.sdc');
    confirm.mockResolvedValueOnce(true);
    await act(async () => { click('保存'); });
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ confirmText: '另存为', message: expect.stringContaining('os error 5') }));
    expect(saveSangDocument.mock.calls[1][1]).toBe('document.sdc');
    expect(saveSangDocument.mock.calls[2][1]).toBeUndefined();
    expect(container.querySelector('[data-testid="save-error"]')?.textContent).toBe('');
    await act(async () => { click('第二次编辑'); });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(saveSangDocument.mock.calls.at(-1)?.[1]).toBe('copy.sdc');
  });

  it('keeps auto-save failures visible without opening a dialog and preserves edits on save-as cancellation', async () => {
    isTauriEnvironment.mockReturnValue(true);
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('保存'); });
    await act(async () => { click('第一次编辑'); });
    saveSangDocument.mockRejectedValueOnce({ code: 'read_only' });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await act(async () => { vi.advanceTimersByTime(1500); });
      expect(confirm).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="save-error"]')?.textContent).toContain('只读');
      saveSangDocument.mockResolvedValueOnce(undefined);
      await act(async () => { click('另存为'); });
      expect(container.querySelector('output')?.textContent).toBe('unsaved');
      expect(container.querySelector('[data-testid="body"]')?.textContent).toBe('first');
      expect(container.querySelector('[data-testid="save-error"]')?.textContent).toContain('只读');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('saves the latest edits after waiting for the failure dialog', async () => {
    isTauriEnvironment.mockReturnValue(true);
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    let finishConfirm!: (value: boolean) => void;
    confirm.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishConfirm = resolve; }));
    saveSangDocument.mockRejectedValueOnce('denied');
    await act(async () => { click('保存'); });
    await act(async () => { click('第二次编辑'); });
    await act(async () => { finishConfirm(true); });
    expect(saveSangDocument.mock.calls.at(-1)?.[0].markdown).toBe('second');
    expect(saveSangDocument.mock.calls.at(-1)?.[1]).toBeUndefined();
  });
});