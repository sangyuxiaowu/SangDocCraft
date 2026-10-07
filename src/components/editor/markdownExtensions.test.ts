import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { getInitialFoldBlocks, getMarkdownFoldBlocks, markdownSupport } from './markdownExtensions';

function createState(doc: string) {
  return EditorState.create({ doc, extensions: [markdownSupport] });
}

describe('Markdown editor folding', () => {
  it.each([5, 6])('folds a fenced code block only when its total length exceeds five lines (%i)', (lines) => {
    const source = ['```json', ...Array.from({ length: lines - 2 }, () => '{}'), '```'].join('\n');
    const state = createState(source);
    expect(getMarkdownFoldBlocks(state)[0]).toMatchObject({ kind: 'code', lines });
    expect(getInitialFoldBlocks(state)).toHaveLength(lines > 5 ? 1 : 0);
    expect(state.doc.toString()).toBe(source);
  });

  it('folds complete HTML elements across blank lines as one block', () => {
    const source = '# Title\n\n<div>\n<p>one</p>\n\n<p>two</p>\n<p>three</p>\n</div>\n\nbody';
    const state = createState(source);
    const blocks = getInitialFoldBlocks(state);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'html', lines: 6, start: source.indexOf('<div>'), to: source.indexOf('</div>') + 6 });
  });

  it('handles multiline opening tags and nested elements', () => {
    const source = '<div\n style="color:red"\n data-name="sample">\n<section>\n<p>one</p>\n</section>\n</div>';
    expect(getInitialFoldBlocks(createState(source))).toEqual([
      expect.objectContaining({ start: 0, to: source.length, kind: 'html', lines: 7 }),
    ]);
  });

  it('does not fold five-line HTML, inline HTML, or headings automatically', () => {
    const source = '# Title\n\n<div>\none\ntwo\nthree\n</div>\n\ntext <sup>2</sup>\n\n## Next\nbody';
    expect(getInitialFoldBlocks(createState(source))).toEqual([]);
  });

  it('treats HTML inside fences as code, not HTML blocks', () => {
    const source = '```html\n<div>\none\ntwo\nthree\n</div>\n```';
    expect(getInitialFoldBlocks(createState(source))).toEqual([
      expect.objectContaining({ kind: 'code', lines: 7 }),
    ]);
  });

  it('does not hide following Markdown for an unclosed HTML element', () => {
    const source = '<div>\none\ntwo\nthree\nfour\nfive\n\n# Next\nbody';
    expect(getInitialFoldBlocks(createState(source))).toEqual([]);
  });

  it('supports indented code and multiline HTML comments', () => {
    expect(getInitialFoldBlocks(createState(Array.from({ length: 6 }, () => '    code').join('\n')))[0]).toMatchObject({ kind: 'code', lines: 6 });
    expect(getInitialFoldBlocks(createState('<!--\none\ntwo\nthree\nfour\n-->'))[0]).toMatchObject({ kind: 'html', lines: 6 });
  });
});