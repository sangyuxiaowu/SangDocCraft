// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { foldedRanges, unfoldAll } from '@codemirror/language';
import { redo, undo } from '@codemirror/commands';
import { Editor, getSelectionStats, type EditorHandle } from './Editor';
import type { DiffReviewSession } from '../types/ai';

let documentCounter = 0;

function renderEditor(value: string, onNavigateToPreview = vi.fn(), scrollSyncEnabled = false, documentId = `test-document-${++documentCounter}`) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  const editorRef = createRef<EditorHandle>();
  const render = (nextValue = value, nextDocumentId = documentId, uiMode: 'dark' | 'light' = 'dark', reviewSession: DiffReviewSession | null = null) => act(() => root.render(
    <StrictMode>
      <Editor
        ref={editorRef}
        value={nextValue}
        onChange={onChange}
        onNavigateToPreview={onNavigateToPreview}
        scrollSyncEnabled={scrollSyncEnabled}
        assets={[]}
        documentId={nextDocumentId}
        uiMode={uiMode}
        onAssetsChanged={async () => {}}
        saveStatus="saved"
        lastSavedAt={null}
        reviewSession={reviewSession}
      />
    </StrictMode>,
  ));
  render();
  const content = container.querySelector<HTMLElement>('.cm-content')!;
  const view = EditorView.findFromDOM(content)!;
  return { root, editorRef, onChange, onNavigateToPreview, content, view, container, render };
}

function pressTab(content: HTMLElement, shiftKey = false) {
  act(() => content.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  })));
}

function selectText(view: EditorView, anchor: number, head = anchor) {
  act(() => view.dispatch({ selection: { anchor, head } }));
}

describe('Editor keyboard indentation', () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    act(() => roots.forEach((root) => root.unmount()));
    roots.length = 0;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('indents a single-line selection without replacing it', () => {
    const rendered = renderEditor('alpha beta');
    roots.push(rendered.root);
    selectText(rendered.view, 6, 10);
    pressTab(rendered.content);
    expect(rendered.onChange).toHaveBeenCalledWith('  alpha beta');
  });

  it('inserts an HTML template at the selection as one undoable edit', async () => {
    const rendered = renderEditor('Before After');
    roots.push(rendered.root);
    selectText(rendered.view, 7);
    await act(async () => rendered.container.querySelector<HTMLButtonElement>('[aria-label="HTML 模板管理"]')!.click());
    const insert = Array.from(rendered.container.querySelectorAll('button')).find(button => button.textContent?.includes('插入模板'))!;
    await act(async () => insert.click());
    expect(rendered.view.state.doc.toString()).toMatch(/Before \n\n<section data-sdc-html>[\s\S]*<\/section>\n\nAfter/);
    expect(foldedRanges(rendered.view.state).size).toBe(1);
    expect(rendered.container.querySelector('.cm-foldPlaceholder')?.textContent).toContain('HTML');
    expect(rendered.view.state.selection.main.empty).toBe(true);
    expect(rendered.view.state.selection.main.from).toBe(rendered.view.state.doc.length - 'After'.length);
    expect(rendered.container.querySelector('[aria-label="HTML 模板管理"][role="dialog"]')).toBeNull();
    act(() => undo(rendered.view));
    expect(rendered.view.state.doc.toString()).toBe('Before After');
    expect(foldedRanges(rendered.view.state).size).toBe(0);
  });

  it('unindents every selected line with Shift+Tab', () => {
    const rendered = renderEditor('  alpha\n  beta');
    roots.push(rendered.root);
    selectText(rendered.view, 0, 14);
    pressTab(rendered.content, true);
    expect(rendered.onChange).toHaveBeenCalledWith('alpha\nbeta');
  });

  it('reports the cursor position when the editor is double-clicked', () => {
    const rendered = renderEditor('alpha beta');
    roots.push(rendered.root);
    selectText(rendered.view, 6, 10);

    act(() => rendered.content.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));

    expect(rendered.onNavigateToPreview).toHaveBeenCalledWith(6);
  });

  it('does not navigate on double click while scroll sync is enabled', () => {
    const onNavigateToPreview = vi.fn();
    const rendered = renderEditor('alpha beta', onNavigateToPreview, true);
    roots.push(rendered.root);

    act(() => rendered.content.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));

    expect(onNavigateToPreview).not.toHaveBeenCalled();
  });

  it('moves the cursor and scrolls to a requested source position', () => {
    const value = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
    const rendered = renderEditor(value);
    roots.push(rendered.root);
    const position = value.indexOf('line 21');
    Object.defineProperties(rendered.view.scrollDOM, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 800 },
    });
    vi.spyOn(rendered.view, 'lineBlockAt').mockReturnValue(Object.assign(rendered.view.lineBlockAt(position), { top: 400 }));
    vi.spyOn(rendered.view, 'documentPadding', 'get').mockReturnValue({ top: 0, bottom: 0 });
    vi.spyOn(rendered.view, 'requestMeasure').mockImplementation((request) => {
      if (request?.read && request.write) request.write(request.read(rendered.view), rendered.view);
    });

    act(() => rendered.editorRef.current?.navigateToPosition(position));

    expect(rendered.view.state.selection.main.from).toBe(position);
    expect(rendered.view.state.selection.main.to).toBe(position);
    expect(rendered.view.scrollDOM.scrollTop).toBe(300);
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

  it.each([
    ['上标', 'x2', 1, 2, 'x<sup>2</sup>'],
    ['下标', 'CO2', 2, 3, 'CO<sub>2</sub>'],
  ])('wraps the selection with %s Markdown HTML', (title, value, start, end, expected) => {
    const rendered = renderEditor(value);
    roots.push(rendered.root);
    selectText(rendered.view, start, end);

    act(() => document.querySelector<HTMLButtonElement>(`button[title="${title}"]`)?.click());

    expect(rendered.onChange).toHaveBeenCalledWith(expected);
  });

  it('shows statistics for the current text selection', () => {
    const rendered = renderEditor('alpha beta');
    roots.push(rendered.root);
    selectText(rendered.view, 0, 5);

    expect(rendered.container.textContent).toContain('已选择 5 字符');
    expect(rendered.container.textContent).toContain('文字数（不含标点符号）5');
  });

  it('renders line numbers and heading backgrounds without marking fenced headings', () => {
    const rendered = renderEditor('# Heading\n\n```text\n# not a heading\n```\n\n## Next');
    roots.push(rendered.root);
    expect(rendered.container.querySelector('.cm-lineNumbers')).not.toBeNull();
    expect(rendered.container.querySelectorAll('.cm-heading-line')).toHaveLength(2);
    expect(rendered.container.querySelector('.cm-heading-1')?.textContent).toBe('# Heading');
  });

  it('folds long HTML and code on initial load without changing the source', () => {
    const source = '<div>\none\ntwo\nthree\nfour\n</div>\n\n```json\n{\n"one": 1,\n"two": 2\n}\n```';
    const rendered = renderEditor(source);
    roots.push(rendered.root);
    expect(foldedRanges(rendered.view.state).size).toBe(2);
    expect(rendered.container.querySelectorAll('.cm-foldPlaceholder')).toHaveLength(2);
    expect(rendered.view.state.doc.toString()).toBe(source);
    expect(rendered.onChange).not.toHaveBeenCalled();
  });

  it('does not refold after manual expansion, typing, external updates, or theme changes', () => {
    const source = '```text\none\ntwo\nthree\nfour\n```';
    const rendered = renderEditor(source);
    roots.push(rendered.root);
    act(() => unfoldAll(rendered.view));
    act(() => rendered.view.dispatch({ changes: { from: rendered.view.state.doc.length, insert: '\nbody' } }));
    rendered.render(`${source}\nbody`);
    rendered.render(`${source}\nupdated`, undefined, 'light');
    expect(foldedRanges(rendered.view.state).size).toBe(0);
    expect(rendered.view.state.doc.toString()).toBe(`${source}\nupdated`);
    expect(rendered.onChange).toHaveBeenCalledTimes(1);
  });

  it('does not automatically fold newly inserted code blocks', () => {
    const rendered = renderEditor('');
    roots.push(rendered.root);
    act(() => rendered.editorRef.current?.insertAtSelection('```text\none\ntwo\nthree\nfour\n```'));
    expect(foldedRanges(rendered.view.state).size).toBe(0);
  });

  it('folds the next document when its identity changes', () => {
    const source = '```text\none\ntwo\nthree\nfour\n```';
    const rendered = renderEditor(source);
    roots.push(rendered.root);
    act(() => unfoldAll(rendered.view));
    rendered.render(source, 'another-document');
    const nextView = EditorView.findFromDOM(rendered.container.querySelector('.cm-content')!)!;
    expect(foldedRanges(nextView.state).size).toBe(1);
  });

  it('keeps initial folding for Windows CRLF documents without reporting edits', () => {
    const source = '# Heading\r\n\r\n```text\r\none\r\ntwo\r\nthree\r\nfour\r\n```\r\n\r\nAfter';
    const rendered = renderEditor(source);
    roots.push(rendered.root);
    expect(foldedRanges(rendered.view.state).size).toBe(1);
    expect(rendered.onChange).not.toHaveBeenCalled();
    rendered.render(source);
    expect(foldedRanges(rendered.view.state).size).toBe(1);
  });

  it('preserves manual fold state when the same editor is remounted', () => {
    const source = '# Heading\r\n\r\n```text\r\none\r\ntwo\r\nthree\r\nfour\r\n```\r\n\r\nAfter';
    const documentId = `remount-${++documentCounter}`;
    const rendered = renderEditor(source, vi.fn(), false, documentId);
    act(() => unfoldAll(rendered.view));
    act(() => rendered.root.unmount());
    const remounted = renderEditor(source, vi.fn(), false, documentId);
    roots.push(remounted.root);
    expect(foldedRanges(remounted.view.state).size).toBe(0);
    act(() => remounted.editorRef.current?.insertAtSelection('new'));
    expect(remounted.onChange).toHaveBeenCalled();
    expect(rendered.onChange).not.toHaveBeenCalled();
  });

  it('preserves folds and selection while AI review makes the editor read-only', () => {
    const source = '# Heading\n\n```text\none\ntwo\nthree\nfour\n```';
    const rendered = renderEditor(source);
    roots.push(rendered.root);
    selectText(rendered.view, 3);
    rendered.render(source, undefined, 'dark', {
      id: 'review', originalText: source, modifiedText: source,
      hunks: [], createdAt: new Date().toISOString(),
    });
    expect(rendered.view.state.readOnly).toBe(true);
    expect(rendered.content.getAttribute('contenteditable')).toBe('false');
    act(() => rendered.editorRef.current?.insertAtSelection('blocked'));
    expect(rendered.onChange).not.toHaveBeenCalled();
    rendered.render(source);
    expect(EditorView.findFromDOM(rendered.content)).toBe(rendered.view);
    expect(rendered.view.state.readOnly).toBe(false);
    expect(rendered.view.state.selection.main.from).toBe(3);
    expect(foldedRanges(rendered.view.state).size).toBe(1);
  });

  it('expands the target fold for explicit navigation but not passive scrolling', () => {
    const source = '```text\none\ntwo\nthree\nfour\n```';
    const rendered = renderEditor(source);
    roots.push(rendered.root);
    const position = source.indexOf('three');
    act(() => rendered.editorRef.current?.scrollToPosition(position));
    expect(foldedRanges(rendered.view.state).size).toBe(1);
    act(() => rendered.editorRef.current?.navigateToPosition(position));
    expect(foldedRanges(rendered.view.state).size).toBe(0);
    expect(rendered.view.state.selection.main.from).toBe(position);
  });

  it('supports undo and redo for toolbar insertion', () => {
    const rendered = renderEditor('hello');
    roots.push(rendered.root);
    selectText(rendered.view, 0, 5);
    act(() => rendered.container.querySelector<HTMLButtonElement>('button[title="粗体"]')?.click());
    expect(rendered.view.state.doc.toString()).toBe('**hello**');
    act(() => undo(rendered.view));
    expect(rendered.view.state.doc.toString()).toBe('hello');
    act(() => redo(rendered.view));
    expect(rendered.view.state.doc.toString()).toBe('**hello**');
  });
});