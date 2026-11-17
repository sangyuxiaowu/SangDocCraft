// @vitest-environment jsdom

import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { WelcomeDashboard } from './WelcomeDashboard';

it('shows the active document above recent documents and resumes through the existing close action', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div');
  const root = createRoot(container);
  const onClose = vi.fn();
  const onCloseDocument = vi.fn();
  const props: ComponentProps<typeof WelcomeDashboard> = {
    isOpen: true, canClose: true, isClosingDocument: false, isDark: false, themeMode: 'light', isTauri: false,
    currentDocument: { title: '当前报告', isSaving: false, hasUnsavedChanges: true },
    drafts: [], recentDocuments: [], onClose, onCloseDocument,
    onThemeModeChange: vi.fn(), onSelectTemplate: vi.fn(), onOpenLocalFile: vi.fn(), onOpenAbout: vi.fn(),
    onRestoreDraft: vi.fn(), onDeleteDraft: vi.fn(), onClearAllDrafts: vi.fn(),
    onOpenRecent: vi.fn(), onRemoveRecent: vi.fn(), onClearRecent: vi.fn(),
  };
  try {
    await act(async () => root.render(<WelcomeDashboard {...props} />));
    const card = container.querySelector('[aria-label="当前打开的文档"]')!;
    expect(card.textContent).toContain('当前报告');
    expect(card.textContent).toContain('有未保存修改');
    expect(card.textContent).toContain('返回欢迎页不会关闭文档');
    expect(card.nextElementSibling?.textContent).toContain('最近文档');
    expect(container.querySelector('button[title="返回当前编辑文档 (Esc)"]')).toBeNull();
    const buttons = card.querySelectorAll('button');
    expect([...buttons].map(button => button.textContent)).toEqual(['关闭文档', '继续编辑']);
    await act(async () => { buttons[0].click(); });
    expect(onCloseDocument).toHaveBeenCalledOnce();
    await act(async () => { buttons[1].click(); });
    expect(onClose).toHaveBeenCalledOnce();

    await act(async () => root.render(<WelcomeDashboard {...props} currentDocument={{
      title: '当前报告', isSaving: false, hasUnsavedChanges: true, saveError: '没有写入权限',
    }} />));
    expect(container.querySelector('[aria-label="当前打开的文档"]')?.textContent).toContain('保存失败');
    expect(container.querySelector('[aria-label="当前打开的文档"]')?.textContent).toContain('没有写入权限');

    await act(async () => root.render(<WelcomeDashboard {...props} isClosingDocument />));
    expect(container.firstElementChild?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('[aria-label="当前打开的文档"] button')?.hasAttribute('disabled')).toBe(true);

    await act(async () => root.render(<WelcomeDashboard {...props} canClose={false} currentDocument={undefined} />));
    expect(container.querySelector('[aria-label="当前打开的文档"]')).toBeNull();
  } finally { act(() => root.unmount()); }
});
