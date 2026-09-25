// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_TEMPLATES } from './data/documentTemplates';
import { createDiffHunks } from './utils/diffUtils';
import type { AiToolContext } from './utils/aiAssistantService';
import App from './App';

const saveDraft = vi.hoisted(() => vi.fn());

vi.mock('./utils/draftStore', async (importOriginal) => ({
  ...await importOriginal<typeof import('./utils/draftStore')>(),
  saveDraft,
  getUnsavedDraftSummaries: async () => [],
  runStorageGC: async () => {},
}));
vi.mock('./utils/documentFileOperations', () => ({ readStartupDocument: async () => undefined }));
vi.mock('./lib/aiConfig', () => ({
  loadAiConfig: () => ({ endpoints: [], activeSelection: {} }),
  loadAiConfigWithSecrets: async () => ({ endpoints: [], activeSelection: {} }),
}));
vi.mock('./utils/imageRepository', () => ({
  listDocumentAssets: async () => [],
  listLibraryAssets: async () => [],
}));
vi.mock('./components/HeaderBar', () => ({
  HeaderBar: ({ onSaveDocument }: { onSaveDocument: () => void }) => <button onClick={onSaveDocument}>保存</button>,
}));
vi.mock('./utils/modalDialog', () => ({ modal: { confirm: async () => true } }));
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
vi.mock('./components/A4Preview', () => ({ A4Preview: () => null }));
vi.mock('./components/StyleConfigPanel', () => ({ StyleConfigPanel: () => null }));
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