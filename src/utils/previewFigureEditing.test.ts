import { describe, expect, it } from 'vitest';
import { findPreviewFigures, getPreviewFigureOptions, updatePreviewFigure } from './previewFigureEditing';

describe('preview figure editing', () => {
  it('only updates the selected occurrence of a repeated image', () => {
    const markdown = '![图](same.png){w=200 align=left}\n\n![图](same.png){w=300 align=right}';
    const figures = findPreviewFigures(markdown);
    expect(figures).toHaveLength(2);
    expect(getPreviewFigureOptions(markdown, figures[1])).toEqual({ width: 300, align: 'right' });
    expect(updatePreviewFigure(markdown, figures[1], { width: 420 })).toBe(
      '![图](same.png){w=200 align=left}\n\n![图](same.png){w=420 align=right}'
    );
  });

  it('only changes the selected Mermaid opener and preserves its source and caption', () => {
    const diagram = '```mermaid {theme=dark width=500px align=left}\nflowchart LR\nA --> B\n```';
    const markdown = `<!-- caption: 示例 -->\n\n${diagram}\n\n${diagram}`;
    const figures = findPreviewFigures(markdown);
    expect(figures).toHaveLength(2);
    expect(getPreviewFigureOptions(markdown, figures[0])).toEqual({ theme: 'dark', width: '500px', align: 'left' });
    expect(updatePreviewFigure(markdown, figures[1], { width: 360, align: 'right', theme: 'forest' })).toBe(
      `<!-- caption: 示例 -->\n\n${diagram}\n\n\`\`\`mermaid {theme=forest w=360 align=right}\nflowchart LR\nA --> B\n\`\`\``
    );
  });

  it('adds attributes to plain images and Mermaid fences', () => {
    const markdown = '![a](one.png)\n\n```mermaid\ngraph TD\nA-->B\n```';
    const figures = findPreviewFigures(markdown);
    expect(updatePreviewFigure(markdown, figures[0], { width: 280 })).toContain('![a](one.png){w=280}');
    expect(updatePreviewFigure(markdown, figures[1], { theme: 'custom' })).toContain('```mermaid {theme=custom}\n');
  });

  it('preserves CRLF offsets when editing a diagram after an image', () => {
    const markdown = '![one](a.png)\r\n\r\n```mermaid\r\ngraph TD\r\nA-->B\r\n```';
    const figures = findPreviewFigures(markdown);
    expect(figures).toHaveLength(2);
    expect(updatePreviewFigure(markdown, figures[1], { align: 'left' })).toBe(
      '![one](a.png)\r\n\r\n```mermaid {align=left}\r\ngraph TD\r\nA-->B\r\n```'
    );
  });

  it('removes explicit theme and height when inheriting defaults', () => {
    const diagram = '```mermaid {theme=dark h=250 align=right}\ngraph TD\nA-->B\n```';
    const figure = findPreviewFigures(diagram)[0];
    expect(updatePreviewFigure(diagram, figure, { theme: '' })).toContain('{h=250 align=right}');
    expect(updatePreviewFigure(diagram, figure, { height: null })).toContain('{theme=dark align=right}');
    const image = '![a](one.png){w=200 h=100 align=left}';
    expect(updatePreviewFigure(image, findPreviewFigures(image)[0], { height: null })).toBe('![a](one.png){w=200 align=left}');
  });

  it('replaces quoted, comma-separated Mermaid attributes without duplicating them', () => {
    const diagram = '```mermaid {theme="forest", w="80%", align=left}\ngraph TD\nA-->B\n```';
    expect(updatePreviewFigure(diagram, findPreviewFigures(diagram)[0], { width: 400 })).toContain('theme="forest", w=400, align=left');
  });

  it('does not select an image example in inline code ahead of the actual image', () => {
    const markdown = '`![same](a.png)` and ![same](a.png)';
    const figures = findPreviewFigures(markdown);
    expect(figures).toHaveLength(1);
    expect(updatePreviewFigure(markdown, figures[0], { width: 240 })).toBe('`![same](a.png)` and ![same](a.png){w=240}');
  });
});