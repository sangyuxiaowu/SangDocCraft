// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor, getSelectionStats, type EditorHandle } from './Editor';

function renderEditor(value: string, onNavigateToPreview = vi.fn(), scrollSyncEnabled = false) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  const editorRef = createRef<EditorHandle>();
  act(() => root.render(
    <Editor
      ref={editorRef}
      value={value}
      onChange={onChange}
      onNavigateToPreview={onNavigateToPreview}
      scrollSyncEnabled={scrollSyncEnabled}
      assets={[]}
      documentId="test-document"
      onAssetsChanged={async () => {}}
      saveStatus="saved"
      lastSavedAt={null}
    />,
  ));
  return { root, editorRef, onChange, onNavigateToPreview, textarea: container.querySelector('textarea')! };
}

function pressTab(textarea: HTMLTextAreaElement, shiftKey = false) {
  act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  })));
}

describe('Editor keyboard indentation', () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    roots.forEach((root) => root.unmount());
    roots.length = 0;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('indents a single-line selection without replacing it', () => {
    const rendered = renderEditor('alpha beta');
    roots.push(rendered.root);
    rendered.textarea.setSelectionRange(6, 10);
    pressTab(rendered.textarea);
    expect(rendered.onChange).toHaveBeenCalledWith('  alpha beta');
  });

  it('unindents every selected line with Shift+Tab', () => {
    const rendered = renderEditor('  alpha\n  beta');
    roots.push(rendered.root);
    rendered.textarea.setSelectionRange(0, 14);
    pressTab(rendered.textarea, true);
    expect(rendered.onChange).toHaveBeenCalledWith('alpha\nbeta');
  });

  it('reports the cursor position when the editor is double-clicked', () => {
    const rendered = renderEditor('alpha beta');
    roots.push(rendered.root);
    rendered.textarea.setSelectionRange(6, 10);

    act(() => rendered.textarea.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));

    expect(rendered.onNavigateToPreview).toHaveBeenCalledWith(6);
  });

  it('does not navigate on double click while scroll sync is enabled', () => {
    const onNavigateToPreview = vi.fn();
    const rendered = renderEditor('alpha beta', onNavigateToPreview, true);
    roots.push(rendered.root);

    act(() => rendered.textarea.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));

    expect(onNavigateToPreview).not.toHaveBeenCalled();
  });

  it('moves the cursor and scrolls to a requested source position', () => {
    const value = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
    const rendered = renderEditor(value);
    roots.push(rendered.root);
    const position = value.indexOf('line 21');
    Object.defineProperties(rendered.textarea, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 800 },
    });
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(400);

    act(() => rendered.editorRef.current?.navigateToPosition(position));

    expect(rendered.textarea.selectionStart).toBe(position);
    expect(rendered.textarea.selectionEnd).toBe(position);
    expect(rendered.textarea.scrollTop).toBe(300);
  });

  it('counts selected text with punctuation, whitespace, and empty lines', () => {
    expect(getSelectionStats('你好， world!\n\n第二行')).toEqual({
      characters: 15,
      textCharacters: 10,
      charactersWithoutLineBreaks: 13,
      charactersWithoutSpacesAndLineBreaks: 12,
      lines: 3,
      nonEmptyLines: 2,
    });
  });

  it('shows statistics for the current text selection', () => {
    const rendered = renderEditor('alpha beta');
    roots.push(rendered.root);
    rendered.textarea.setSelectionRange(0, 5);

    act(() => rendered.textarea.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));

    expect(rendered.textarea.closest('.flex.flex-col')?.textContent).toContain('已选择 5 字符');
    expect(rendered.textarea.closest('.flex.flex-col')?.textContent).toContain('文字数（不含标点符号）5');
  });
});