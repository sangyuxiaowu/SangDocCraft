// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_TEMPLATES } from './data/documentTemplates';
import { createDiffHunks } from './utils/diffUtils';
import type { DocumentAsset, DocumentTheme } from './types';
import type { AiToolContext } from './utils/aiAssistantService';
import App from './App';

const { saveDraft, saveSangDocument, listChatSessions, listLibraryAssets, isTauriEnvironment } = vi.hoisted(() => ({
  saveDraft: vi.fn(),
  saveSangDocument: vi.fn(),
  listChatSessions: vi.fn(),
  listLibraryAssets: vi.fn(),
  isTauriEnvironment: vi.fn(() => false),
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
  saveSangDocument,
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
  listDocumentAssets: async () => [],
  listLibraryAssets,
  listChatSessions,
}));
vi.mock('./components/HeaderBar', () => ({
  HeaderBar: ({ onSaveDocument }: { onSaveDocument: () => void }) => <button onClick={onSaveDocument}>保存</button>,
}));
vi.mock('./utils/modalDialog', () => ({ modal: { confirm: async () => true, alert: async () => {} } }));
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
  WelcomeDashboard: ({ onSelectTemplate }: { onSelectTemplate: (template: typeof DOCUMENT_TEMPLATES[number]) => void }) => (
    <button onClick={() => onSelectTemplate(DOCUMENT_TEMPLATES[0])}>新建</button>
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
  const click = (text: string) => [...container.querySelectorAll('button')].find((button) => button.textContent === text)!.click();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    isTauriEnvironment.mockReturnValue(false);
    listChatSessions.mockResolvedValue([]);
    listLibraryAssets.mockResolvedValue([]);
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

  it('does not change the active document when the previous document finishes saving', async () => {
    await act(async () => { root.render(<App />); });
    await act(async () => { click('新建'); });
    await act(async () => { click('第一次编辑'); });
    await act(async () => { click('保存'); });

    await act(async () => { click('新建'); });
    await act(async () => { click('第二次编辑'); });
    await act(async () => { pendingSaves[0](); });
    expect(container.querySelector('output')?.textContent).toBe('unsaved');
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
});