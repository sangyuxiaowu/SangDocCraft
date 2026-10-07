import { EditorSelection, type EditorState, type Text } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type KeyBinding } from '@codemirror/view';
import { foldService, HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { indentLess, indentMore } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { htmlLanguage } from '@codemirror/lang-html';
import { javascriptLanguage, typescriptLanguage } from '@codemirror/lang-javascript';
import { jsonLanguage } from '@codemirror/lang-json';
import { cssLanguage } from '@codemirror/lang-css';
import { pythonLanguage } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { tags } from '@lezer/highlight';

export interface MarkdownFoldBlock {
  from: number;
  to: number;
  start: number;
  lines: number;
  kind: 'html' | 'code';
}

const blockCache = new WeakMap<Text, MarkdownFoldBlock[]>();

export function getMarkdownFoldBlocks(state: EditorState): MarkdownFoldBlock[] {
  const cached = blockCache.get(state.doc);
  if (cached) return cached;
  const source = state.doc.toString();
  const tree = markdownLanguage.parser.parse(source);
  const blocks: MarkdownFoldBlock[] = [];
  const htmlRanges: { from: number; to: number }[] = [];
  const addBlock = (start: number, end: number, kind: MarkdownFoldBlock['kind']) => {
    const firstLine = state.doc.lineAt(start);
    const lastLine = state.doc.lineAt(end);
    if (firstLine.number === lastLine.number) return;
    blocks.push({ start, from: firstLine.to, to: end, lines: lastLine.number - firstLine.number + 1, kind });
  };
  tree.iterate({
    enter(node) {
      if (node.name === 'FencedCode' || node.name === 'CodeBlock') {
        addBlock(node.from, node.to, 'code');
        return false;
      }
      if (node.name === 'HTMLBlock' || node.name === 'CommentBlock') {
        htmlRanges.push({ from: node.from, to: node.to });
        return false;
      }
    },
  });
  if (htmlRanges.length) {
    htmlLanguage.parser.parse(source).iterate({
      enter(node) {
        if (node.name !== 'Element' && node.name !== 'Comment') return;
        if (!htmlRanges.some((range) => node.from >= range.from && node.from < range.to)) return;
        if (node.name === 'Element' && node.node.lastChild?.name !== 'CloseTag') return;
        if (node.name === 'Comment' && !source.slice(node.from, node.to).endsWith('-->')) return;
        addBlock(node.from, node.to, 'html');
        return false;
      },
    });
  }
  blocks.sort((first, second) => first.start - second.start);
  blockCache.set(state.doc, blocks);
  return blocks;
}

export function getInitialFoldBlocks(state: EditorState): MarkdownFoldBlock[] {
  return getMarkdownFoldBlocks(state).filter((block) => block.lines > 5);
}

export const markdownBlockFolding = foldService.of((state, lineStart, lineEnd) => {
  return getMarkdownFoldBlocks(state).find((block) => block.start >= lineStart && block.start <= lineEnd) ?? null;
});

function getHeadingDecorations(view: EditorView): DecorationSet {
  const decorations: { position: number; decoration: Decoration }[] = [];
  for (const range of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(node.name);
        if (!heading) return;
        const firstLine = view.state.doc.lineAt(node.from);
        const lastLine = view.state.doc.lineAt(node.to);
        for (let lineNumber = firstLine.number; lineNumber <= lastLine.number; lineNumber++) {
          const position = view.state.doc.line(lineNumber).from;
          if (!decorations.some((entry) => entry.position === position)) {
            decorations.push({ position, decoration: Decoration.line({ class: `cm-heading-line cm-heading-${heading[1]}` }) });
          }
        }
      },
    });
  }
  return Decoration.set(decorations.map((entry) => entry.decoration.range(entry.position)), true);
}

export const headingBackgrounds = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(view: EditorView) {
    this.decorations = getHeadingDecorations(view);
  }
  update(update: { view: EditorView }) {
    this.decorations = getHeadingDecorations(update.view);
  }
}, { decorations: (plugin) => plugin.decorations });

const codeLanguages = new Map([
  ['javascript', javascriptLanguage], ['js', javascriptLanguage],
  ['typescript', typescriptLanguage], ['ts', typescriptLanguage],
  ['jsx', javascriptLanguage], ['tsx', typescriptLanguage],
  ['json', jsonLanguage], ['html', htmlLanguage], ['xml', htmlLanguage],
  ['css', cssLanguage], ['python', pythonLanguage], ['py', pythonLanguage],
  ['sql', sql().language],
]);

export const markdownSupport = markdown({
  base: markdownLanguage,
  codeLanguages: (info) => codeLanguages.get(info.trim().split(/\s+/)[0].toLowerCase()) ?? null,
  completeHTMLTags: false,
  pasteURLAsLink: false,
  addKeymap: false,
});

export const markdownTabBinding: KeyBinding = {
  key: 'Tab',
  run(view) {
    if (!view.state.selection.main.empty) return indentMore(view);
    const position = view.state.selection.main.from;
    view.dispatch({ changes: { from: position, insert: '  ' }, selection: EditorSelection.cursor(position + 2), userEvent: 'input' });
    return true;
  },
  shift: indentLess,
};

export const markdownHighlighting = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.heading, color: 'var(--editor-heading-text)' },
  { tag: tags.keyword, color: 'var(--editor-keyword)' },
  { tag: [tags.string, tags.inserted], color: 'var(--editor-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--editor-number)' },
  { tag: [tags.comment, tags.meta], color: 'var(--editor-muted)' },
  { tag: [tags.tagName, tags.typeName], color: 'var(--editor-tag)' },
  { tag: [tags.attributeName, tags.propertyName], color: 'var(--editor-property)' },
  { tag: [tags.link, tags.url], color: 'var(--editor-link)', textDecoration: 'underline' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
]));