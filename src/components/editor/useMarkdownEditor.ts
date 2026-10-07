import { useLayoutEffect, useRef } from 'react';
import { Compartment, EditorState, StateEffect, Transaction } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { codeFolding, foldEffect, foldedRanges, foldGutter, foldKeymap, unfoldEffect } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { createEditorTheme, type EditorTypography } from './editorTheme';
import { getInitialFoldBlocks, headingBackgrounds, markdownBlockFolding, markdownHighlighting, markdownSupport, markdownTabBinding } from './markdownExtensions';

interface MarkdownEditorOptions {
  value: string;
  documentId: string;
  isDark: boolean;
  typography: EditorTypography;
  reviewing: boolean;
  onChange: (value: string) => void;
  onSelectionChange: (value: string) => void;
  onPaste: (event: ClipboardEvent, view: EditorView) => void;
  scrollSyncEnabled: boolean;
  onNavigateToPreview?: (position: number) => void;
  onScrollPositionChange?: (position: number) => void;
}

const savedEditorStates = new Map<string, EditorState>();

export function useMarkdownEditor(options: MarkdownEditorOptions) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const themeRef = useRef(new Compartment());
  const editableRef = useRef(new Compartment());
  const scrollFrameRef = useRef(0);
  const expectedScrollTopRef = useRef<number | null>(null);

  const scrollToPosition = (position: number) => {
    const view = viewRef.current;
    if (!view) return;
    const safePosition = Math.max(0, Math.min(position, view.state.doc.length));
    view.requestMeasure({
      key: scrollFrameRef,
      read: () => Math.max(0, Math.min(
        view.lineBlockAt(safePosition).top + view.documentPadding.top - view.scrollDOM.clientHeight / 3,
        view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight,
      )),
      write: (scrollTop) => {
        if (Math.abs(view.scrollDOM.scrollTop - scrollTop) <= 1) return;
        expectedScrollTopRef.current = scrollTop;
        view.scrollDOM.scrollTop = scrollTop;
      },
    });
  };

  const navigateToPosition = (position: number) => {
    const view = viewRef.current;
    if (!view) return;
    const safePosition = Math.max(0, Math.min(position, view.state.doc.length));
    const effects: ReturnType<typeof unfoldEffect.of>[] = [];
    foldedRanges(view.state).between(safePosition, safePosition, (from, to) => {
      if (safePosition > from && safePosition <= to) effects.push(unfoldEffect.of({ from, to }));
    });
    view.dispatch({ selection: { anchor: safePosition }, effects });
    view.focus();
    scrollToPosition(safePosition);
  };

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const current = optionsRef.current;
    const savedState = savedEditorStates.get(current.documentId);
    const extensions = [
      lineNumbers(), highlightActiveLineGutter(), drawSelection(), history(),
      EditorView.lineWrapping, markdownSupport, markdownHighlighting, headingBackgrounds, markdownBlockFolding,
      keymap.of([markdownTabBinding, ...defaultKeymap, ...historyKeymap, ...foldKeymap]),
      foldGutter({ markerDOM: (open) => {
        const marker = document.createElement('span');
        marker.textContent = open ? '\u2304' : '\u203a';
        marker.title = open ? '折叠' : '展开';
        return marker;
      } }),
      codeFolding({
        preparePlaceholder: (state, range) => ({
          lines: state.doc.lineAt(range.to).number - state.doc.lineAt(range.from).number,
          kind: /^\s*(?:<|<!--)/.test(state.doc.lineAt(range.from).text) ? 'HTML' : '代码',
        }),
        placeholderDOM: (_view, onclick, prepared: { lines: number; kind: string }) => {
          const element = document.createElement('span');
          element.className = 'cm-foldPlaceholder';
          element.textContent = `${prepared.kind} · ${prepared.lines} 行`;
          element.title = '展开源码';
          element.setAttribute('role', 'button');
          element.tabIndex = 0;
          element.onclick = onclick;
          element.onkeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onclick(event);
            }
          };
          return element;
        },
      }),
      placeholder('在此处输入或粘贴您的 Markdown 文档内容...'),
      themeRef.current.of(createEditorTheme(current.isDark, current.typography)),
      editableRef.current.of([EditorView.editable.of(!current.reviewing), EditorState.readOnly.of(current.reviewing)]),
      EditorView.contentAttributes.of({ 'aria-label': 'Markdown 编辑器', spellcheck: 'false' }),
      EditorView.updateListener.of((update) => {
        const latest = optionsRef.current;
        if (update.docChanged && !update.transactions.some((transaction) => transaction.annotation(Transaction.remote))) {
          latest.onChange(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          const selection = update.state.selection.main;
          latest.onSelectionChange(update.state.sliceDoc(selection.from, selection.to));
        }
      }),
      EditorView.domEventHandlers({
        paste: (event, view) => {
          optionsRef.current.onPaste(event, view);
          return event.defaultPrevented;
        },
        dblclick: (_event, view) => {
          const latest = optionsRef.current;
          if (!latest.scrollSyncEnabled) latest.onNavigateToPreview?.(view.state.selection.main.from);
        },
        scroll: (_event, view) => {
          const latest = optionsRef.current;
          if (!latest.scrollSyncEnabled || !latest.onScrollPositionChange) return;
          const expected = expectedScrollTopRef.current;
          expectedScrollTopRef.current = null;
          if (expected !== null && Math.abs(view.scrollDOM.scrollTop - expected) <= 1) return;
          cancelAnimationFrame(scrollFrameRef.current);
          scrollFrameRef.current = requestAnimationFrame(() => {
            const position = view.lineBlockAtHeight(Math.max(0,
              view.scrollDOM.scrollTop + view.scrollDOM.clientHeight / 3 - view.documentPadding.top,
            )).from;
            optionsRef.current.onScrollPositionChange?.(position);
          });
        },
      }),
    ];
    const restoresSavedState = savedState && savedState.doc.eq(savedState.toText(current.value));
    const state = restoresSavedState
      ? savedState.update({ effects: StateEffect.reconfigure.of(extensions) }).state
      : EditorState.create({ doc: current.value, extensions });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;
    if (!restoresSavedState) {
      view.dispatch({ effects: getInitialFoldBlocks(view.state).map((block) => foldEffect.of(block)) });
    }
    return () => {
      savedEditorStates.delete(current.documentId);
      savedEditorStates.set(current.documentId, view.state);
      if (savedEditorStates.size > 5) savedEditorStates.delete(savedEditorStates.keys().next().value!);
      cancelAnimationFrame(scrollFrameRef.current);
      expectedScrollTopRef.current = null;
      view.destroy();
      viewRef.current = null;
    };
  }, [options.documentId]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const nextValue = view.state.toText(options.value).toString();
    const previous = view.state.doc.toString();
    if (nextValue === previous) return;
    let from = 0;
    while (from < previous.length && from < nextValue.length && previous[from] === nextValue[from]) from++;
    let oldEnd = previous.length;
    let newEnd = nextValue.length;
    while (oldEnd > from && newEnd > from && previous[oldEnd - 1] === nextValue[newEnd - 1]) { oldEnd--; newEnd--; }
    view.dispatch({
      changes: { from, to: oldEnd, insert: nextValue.slice(from, newEnd) },
      annotations: [Transaction.addToHistory.of(true), Transaction.remote.of(true)],
    });
  }, [options.value, options.documentId]);

  useLayoutEffect(() => {
    viewRef.current?.dispatch({ effects: [
      themeRef.current.reconfigure(createEditorTheme(options.isDark, options.typography)),
      editableRef.current.reconfigure([EditorView.editable.of(!options.reviewing), EditorState.readOnly.of(options.reviewing)]),
    ] });
    viewRef.current?.requestMeasure();
  }, [options.isDark, options.typography, options.reviewing, options.documentId]);

  return { hostRef, viewRef, navigateToPosition, scrollToPosition };
}