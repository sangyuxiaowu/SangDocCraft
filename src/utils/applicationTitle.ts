export interface DocumentTitleContext {
  themeTitle?: string;
  documentPath?: string;
  markdown?: string;
}

export function resolveDocumentTitle(context?: DocumentTitleContext): string {
  if (!context) return '未命名文档';

  // 1. document meta title if set and not the default placeholder
  const cleanThemeTitle = context.themeTitle?.trim();
  if (cleanThemeTitle && cleanThemeTitle !== '未命名文档') {
    return cleanThemeTitle;
  }

  // 2. Extract from document file path if available (e.g. /path/to/架构方案.sdc -> 架构方案)
  if (context.documentPath) {
    const normalized = context.documentPath.replace(/\\/g, '/');
    const baseName = normalized.split('/').pop() || '';
    const titleFromPath = baseName.replace(/\.sdc$/i, '').trim();
    if (titleFromPath) {
      return titleFromPath;
    }
  }

  // 3. Extract first Markdown H1 title (# 标题)
  if (context.markdown) {
    const match = context.markdown.match(/^#\s+(.+)$/m);
    if (match?.[1]) {
      const h1 = match[1].trim();
      if (h1) return h1;
    }
  }

  if (cleanThemeTitle) {
    return cleanThemeTitle;
  }

  return '未命名文档';
}

export function formatApplicationTitle(documentTitle?: string, isWelcome = false): string {
  if (isWelcome) {
    return 'SangDocCraft - 智能 Markdown 排版工具';
  }
  return `${documentTitle?.trim() || '未命名文档'} - SangDocCraft`;
}
