// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { RecentDocumentList } from './RecentDocumentList';

it('mixes local files and drafts by recency, shows paths or file names, and keeps removal separate from deletion', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div');
  const root = createRoot(container);
  const onOpenRecent = vi.fn();
  const onRestoreDraft = vi.fn();
  const onRemoveRecent = vi.fn();
  const onDeleteDraft = vi.fn();
  const files = [
    { id: 'native', title: '磁盘文档', path: 'C:\\Docs\\local.sdc', lastOpenedAt: '2026-01-01' },
    { id: 'web', title: 'PWA 文档', fileHandleId: 'handle', fileName: 'browser.sdc', lastOpenedAt: '2026-01-03' },
  ];
  const draft = { documentId: 'draft', title: '草稿', updatedAt: '2026-01-02', themeName: '标准', charCount: 20, lineCount: 1 };
  try {
    await act(async () => root.render(<RecentDocumentList
      isDark={false} recentDocuments={files} drafts={[draft]}
      onOpenRecent={onOpenRecent} onRestoreDraft={onRestoreDraft}
      onRemoveRecent={onRemoveRecent} onDeleteDraft={onDeleteDraft}
      onClearRecent={vi.fn()} onClearAllDrafts={vi.fn()}
    />));
    const rows = [...container.querySelectorAll('li')];
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('PWA 文档本地文件browser.sdc'),
      expect.stringContaining('草稿浏览器草稿'),
      expect.stringContaining('磁盘文档本地文件C:\\Docs\\local.sdc'),
    ]);
    expect(container.textContent).not.toContain('浏览器不提供完整路径');
    await act(async () => {
      rows[0].querySelector('button')!.click();
      rows[1].querySelector('button')!.click();
      rows[0].querySelectorAll('button')[1].click();
      rows[1].querySelectorAll('button')[1].click();
    });

    expect(onOpenRecent).toHaveBeenCalledExactlyOnceWith(files[1]);
    expect(onRestoreDraft).toHaveBeenCalledExactlyOnceWith(draft);
    expect(onRemoveRecent).toHaveBeenCalledExactlyOnceWith('web');
    expect(onDeleteDraft).toHaveBeenCalledExactlyOnceWith('draft');
  } finally { act(() => root.unmount()); }
});

it.each([
  { title: '调研报告', fileName: '调研报告.sdc' },
  { title: '调研报告.sdc', fileName: '调研报告.sdc' },
  { title: '调研报告', fileName: undefined },
])('does not repeat the document title as a secondary file name: $fileName', async ({ title, fileName }) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<RecentDocumentList
      isDark={false} drafts={[]}
      recentDocuments={[{ id: 'web', title, fileName, fileHandleId: 'handle', lastOpenedAt: '2026-01-03' }]}
      onOpenRecent={vi.fn()} onRestoreDraft={vi.fn()} onRemoveRecent={vi.fn()}
      onDeleteDraft={vi.fn()} onClearRecent={vi.fn()} onClearAllDrafts={vi.fn()}
    />));
    const row = container.querySelector('li')!;
    expect(row.textContent?.split(title)).toHaveLength(2);
    expect(row.querySelector('[title]')?.getAttribute('title')).toBe(title);
    expect(row.querySelector('span.block')).toBeNull();
  } finally { act(() => root.unmount()); }
});
