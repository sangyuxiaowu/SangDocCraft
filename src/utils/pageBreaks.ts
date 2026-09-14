import { marked, type Token, type Tokens } from 'marked';

const pageBreakPattern = /^(?:<!--\s*pagebreak\s*-->|<div\b[^>]*(?:page-break-after|class=["']page-break["'])[^>]*>\s*<\/div>)$/i;

function splitInline(source: string): string[] {
  const parts = [''];
  for (const token of marked.Lexer.lexInline(source)) {
    if (token.type === 'html' && pageBreakPattern.test(token.raw.trim())) {
      parts.push('');
    } else {
      parts[parts.length - 1] += token.raw;
    }
  }
  return parts;
}

function splitTable(token: Tokens.Table): string[] {
  const lines = token.raw.trimEnd().split('\n');
  const headerParts = splitInline(lines[0]);
  if (headerParts.length > 1) {
    const cleaned = [headerParts.join(''), ...lines.slice(1)].join('\n');
    return ['', ...splitBlocks(marked.lexer(cleaned))];
  }
  if (!token.rows.length) return [token.raw];
  const header = lines.slice(0, 2).join('\n');
  const pages: string[] = [];
  let rows: string[] = [];
  for (const row of lines.slice(2)) {
    const parts = splitInline(row);
    if (parts.length > 1) {
      pages.push(rows.length ? `${header}\n${rows.join('\n')}\n` : '');
      rows = [];
    }
    const cleaned = parts.join('');
    if (parts.length === 1 || cleaned.replace(/[|\s]/g, '')) rows.push(cleaned);
  }
  pages.push(rows.length ? `${header}\n${rows.join('\n')}\n` : '');
  return pages;
}

function splitList(token: Tokens.List): string[] {
  const pages = [''];
  token.items.forEach((item, index) => {
    const parts = splitBlocks(item.tokens);
    const marker = token.ordered ? `${Number(token.start) + index}. ` : '- ';
    const checkbox = item.task ? `[${item.checked ? 'x' : ' '}] ` : '';
    parts.forEach((part, partIndex) => {
      if (partIndex > 0) pages.push('');
      if (!part.trim()) return;
      const content = checkbox + part.trimEnd();
      pages[pages.length - 1] += marker + content.replace(/\n/g, `\n${' '.repeat(marker.length)}`) + (token.loose ? '\n\n' : '\n');
    });
  });
  return pages;
}

function splitToken(token: Token): string[] {
  if (token.type === 'code' || token.type === 'codespan') return [token.raw];
  if (token.type === 'table') return splitTable(token as Tokens.Table);
  if (token.type === 'list') return splitList(token as Tokens.List);
  if (token.type === 'blockquote') {
    return splitBlocks(token.tokens || []).map(part => part.trim() ? part.trimEnd().split('\n').map(line => `> ${line}`).join('\n') + '\n' : '');
  }
  if (token.type === 'html') {
    if ('pre' in token && token.pre) return [token.raw];
    const pages = [''];
    for (const line of token.raw.split(/(?<=\n)/)) {
      if (pageBreakPattern.test(line.trim())) pages.push('');
      else pages[pages.length - 1] += line;
    }
    return pages;
  }
  if (token.type === 'paragraph' || token.type === 'text') return splitInline(token.raw);
  return [token.raw];
}

function splitBlocks(tokens: Token[]): string[] {
  const pages = [''];
  let tableHeader = '';
  let afterBreak = false;
  for (const token of tokens) {
    let current = token;
    if (tableHeader && afterBreak && token.type === 'paragraph') {
      const continued = marked.lexer(`${tableHeader}\n${token.raw}`);
      if (continued.length === 1 && continued[0].type === 'table') current = continued[0];
    }
    const parts = splitToken(current);
    parts.forEach((part, index) => {
      if (index > 0) pages.push('');
      pages[pages.length - 1] += part;
    });
    if (current.type === 'table') {
      tableHeader = current.raw.trimEnd().split('\n').slice(0, 2).join('\n');
      afterBreak = parts.length > 1;
    } else if (parts.length > 1 && parts.every(part => !part.trim())) {
      afterBreak = true;
    } else if (current.type !== 'space') {
      tableHeader = '';
      afterBreak = false;
    }
  }
  return pages;
}

export function splitExplicitPages(markdown: string): string[] {
  const pages = splitBlocks(marked.lexer(markdown)).map(page => page.trim()).filter(Boolean);
  return pages.length ? pages : [''];
}

export function getPageBreakInsertion(markdown: string, cursor: number): { position: number; text: string } {
  const lineStart = markdown.lastIndexOf('\n', cursor - 1) + 1;
  const nextNewline = markdown.indexOf('\n', cursor);
  const line = markdown.slice(lineStart, nextNewline < 0 ? markdown.length : nextNewline).replace(/\r$/, '');
  const isTableLine = (tokens: Token[]): boolean => tokens.some(token =>
    (token.type === 'table' && token.raw.split('\n').includes(line)) ||
    (token.type === 'list' && (token as Tokens.List).items.some(item => isTableLine(item.tokens))) ||
    (token.type === 'blockquote' && isTableLine(token.tokens || [])),
  );
  if (line.includes('|') && isTableLine(marked.lexer(markdown))) {
    return { position: lineStart, text: '<!-- pagebreak -->\n' };
  }
  const listPrefix = line.match(/^([ \t]*(?:[-+*]|\d+[.)])[ \t]+)(?:\[[ xX]\][ \t]+)?/);
  if (listPrefix) return { position: lineStart + listPrefix[0].length, text: `<!-- pagebreak -->\n${' '.repeat(listPrefix[1].length)}` };
  return { position: cursor, text: '\n\n<!-- pagebreak -->\n\n' };
}