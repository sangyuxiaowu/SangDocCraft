import { describe, expect, it } from 'vitest';
import { formatApplicationTitle, resolveDocumentTitle } from './applicationTitle';

describe('application title', () => {
  it('formats the current document title', () => {
    expect(formatApplicationTitle('架构设计')).toBe('架构设计 - SangDocCraft');
  });

  it('uses an untitled fallback for empty names', () => {
    expect(formatApplicationTitle('  ')).toBe('未命名文档 - SangDocCraft');
  });

  it('formats title for welcome dashboard without document name', () => {
    expect(formatApplicationTitle(undefined, true)).toBe('SangDocCraft - 智能 Markdown 排版工具');
    expect(formatApplicationTitle('某个未保存草稿', true)).toBe('SangDocCraft - 智能 Markdown 排版工具');
  });

  it('resolves document title from theme title, path, or markdown content', () => {
    // 1. Theme title takes precedence if customized
    expect(resolveDocumentTitle({
      themeTitle: '微服务架构设计规范',
      documentPath: '/path/to/old.sdc',
      markdown: '# 其他标题',
    })).toBe('微服务架构设计规范');

    // 2. Extracts from document path when theme title is generic/empty
    expect(resolveDocumentTitle({
      themeTitle: '未命名文档',
      documentPath: '/Users/test/Documents/核心系统交付说明书.sdc',
      markdown: '# 文档正文',
    })).toBe('核心系统交付说明书');

    // 3. Extracts from Markdown H1 if no valid path or theme title
    expect(resolveDocumentTitle({
      themeTitle: '',
      markdown: '# 快速上手实战指南\n\n正文内容...',
    })).toBe('快速上手实战指南');

    // 4. Fallback to 未命名文档
    expect(resolveDocumentTitle({})).toBe('未命名文档');
  });
});
