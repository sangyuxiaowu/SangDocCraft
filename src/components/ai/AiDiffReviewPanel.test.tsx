// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiffHunk } from '../../types/ai';
import { acceptHunk, rejectHunk } from '../../utils/diffUtils';
import { AiDiffReviewPanel } from './AiDiffReviewPanel';

function createHunk(id: string, line: number): DiffHunk {
  return {
    id,
    type: 'change',
    lines: [
      { type: 'removed', content: `旧内容 ${line}`, oldLineNumber: line },
      { type: 'added', content: `新内容 ${line}`, newLineNumber: line },
    ],
    originalLines: [`旧内容 ${line}`],
    modifiedLines: [`新内容 ${line}`],
    oldStartLine: line,
    newStartLine: line,
    status: 'pending',
  };
}

describe('AiDiffReviewPanel navigation', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('scrolls to the first change and advances 500ms after each single resolution', () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    function Harness() {
      const [hunks, setHunks] = useState([
        createHunk('hunk-1', 10),
        createHunk('hunk-2', 20),
        createHunk('hunk-3', 30),
      ]);
      return (
        <AiDiffReviewPanel
          sessionId="review-1"
          hunks={hunks}
          onAcceptHunk={hunkId => setHunks(previous => acceptHunk(previous, hunkId))}
          onRejectHunk={hunkId => setHunks(previous => rejectHunk(previous, hunkId))}
          onAcceptAll={() => undefined}
          onRejectAll={() => undefined}
          onApplyResolution={() => undefined}
          onCancelReview={() => undefined}
          isDark={false}
        />
      );
    }

    act(() => root.render(<Harness />));
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).dataset.hunkId).toBe('hunk-1');
    expect(container.querySelector<HTMLButtonElement>('button[title="应用当前已确认的变更并返回编辑器"]')!.disabled).toBe(true);

    const firstHunk = container.querySelector<HTMLElement>('[data-hunk-id="hunk-1"]')!;
    act(() => firstHunk.querySelector<HTMLButtonElement>('button[title="接受此处的 AI 修改"]')!.click());
    act(() => vi.advanceTimersByTime(499));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect((scrollIntoView.mock.contexts[1] as HTMLElement).dataset.hunkId).toBe('hunk-2');

    const secondHunk = container.querySelector<HTMLElement>('[data-hunk-id="hunk-2"]')!;
    act(() => secondHunk.querySelector<HTMLButtonElement>('button[title="放弃此段修改，保留原内容"]')!.click());
    act(() => vi.advanceTimersByTime(500));
    expect((scrollIntoView.mock.contexts[2] as HTMLElement).dataset.hunkId).toBe('hunk-3');

    const thirdHunk = container.querySelector<HTMLElement>('[data-hunk-id="hunk-3"]')!;
    act(() => thirdHunk.querySelector<HTMLButtonElement>('button[title="接受此处的 AI 修改"]')!.click());
    expect(container.querySelector<HTMLButtonElement>('button[title="应用当前已确认的变更并返回编辑器"]')!.disabled).toBe(false);

    act(() => root.unmount());
  });
});
