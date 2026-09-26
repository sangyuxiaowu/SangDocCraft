import { marked } from 'marked';
import { extractImageDimensionSuffix, formatImageDimensionSuffix, type ImageDimensions } from './imageDimensions';
import { isMermaidLang, parseMermaidFenceOptions, type MermaidFenceOptions } from './mermaidRenderer';

export type PreviewFigure = { kind: 'image' | 'mermaid'; start: number; end: number };

export function findPreviewFigures(markdown: string): PreviewFigure[] {
  const figures: PreviewFigure[] = [];
  const source = markdown.replace(/\r\n?/g, '\n');
  const offsets: number[] = [];
  for (let index = 0; index < markdown.length; index++) {
    if (markdown[index] === '\r' && markdown[index + 1] === '\n') continue;
    offsets.push(index);
  }
  offsets.push(markdown.length);
  let cursor = 0;
  for (const block of marked.lexer(source)) {
    const blockStart = source.indexOf(block.raw, cursor);
    if (blockStart < 0) continue;
    cursor = blockStart + block.raw.length;
    let localCursor = 0;
    marked.walkTokens([block], (token) => {
      if (token.type === 'codespan' || token.type === 'escape') {
        const offset = block.raw.indexOf(token.raw, localCursor);
        if (offset >= 0) localCursor = offset + token.raw.length;
        return;
      }
      if (token.type !== 'image' && !(token.type === 'code' && isMermaidLang(token.lang))) return;
      const offset = block.raw.indexOf(token.raw, localCursor);
      if (offset < 0) return;
      const start = blockStart + offset;
      figures.push({ kind: token.type === 'image' ? 'image' : 'mermaid', start: offsets[start], end: offsets[start + token.raw.length] });
      localCursor = offset + token.raw.length;
    });
  }
  return figures;
}

export function getPreviewFigureOptions(markdown: string, figure: PreviewFigure): ImageDimensions | MermaidFenceOptions {
  if (figure.kind === 'image') {
    return extractImageDimensionSuffix(markdown.slice(figure.end))?.dimensions ?? {};
  }
  const opener = markdown.slice(figure.start, figure.end).split(/\r?\n/, 1)[0];
  return parseMermaidFenceOptions(opener.replace(/^\s*(?:`{3,}|~{3,})\s*/, '')) ?? {};
}

export function updatePreviewFigure(
  markdown: string,
  figure: PreviewFigure,
  change: { width?: number; height?: number | null; align?: 'left' | 'center' | 'right'; theme?: string }
): string {
  if (figure.kind === 'image') {
    const existing = extractImageDimensionSuffix(markdown.slice(figure.end));
    const dimensions = { ...existing?.dimensions, ...change, height: change.height === null ? undefined : change.height ?? existing?.dimensions.height };
    const suffix = formatImageDimensionSuffix(dimensions);
    return markdown.slice(0, figure.end) + suffix + markdown.slice(figure.end + (existing?.length ?? 0));
  }

  const source = markdown.slice(figure.start, figure.end);
  const lineEnd = source.search(/\r?\n/);
  if (lineEnd < 0) return markdown;
  const opener = source.slice(0, lineEnd);
  const braces = opener.match(/\{([^{}]*)\}/);
  let attributes = braces?.[1].trim() ?? '';
  for (const [key, value] of Object.entries(change)) {
    if (value === undefined) continue;
    const name = key === 'width' ? 'w' : key === 'height' ? 'h' : key;
    const pattern = new RegExp(`(^|[\\s,;])(?:${name}${name === 'w' ? '|width' : name === 'h' ? '|height' : ''})\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s,;{}]+)`, 'i');
    if (value === null || value === '') {
      attributes = attributes.replace(pattern, '').replace(/[ \t]{2,}/g, ' ').replace(/^[,;\s]+|[,;\s]+$/g, '');
    } else {
      attributes = pattern.test(attributes)
        ? attributes.replace(pattern, (_match, separator: string) => `${separator}${name}=${value}`)
        : `${attributes}${attributes ? ' ' : ''}${name}=${value}`;
    }
  }
  const nextOpener = braces
    ? opener.replace(braces[0], attributes ? `{${attributes}}` : '').trimEnd()
    : attributes ? `${opener} {${attributes}}` : opener;
  return markdown.slice(0, figure.start) + nextOpener + markdown.slice(figure.start + opener.length);
}