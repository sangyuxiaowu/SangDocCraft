export function formatApplicationTitle(documentTitle?: string): string {
  return `${documentTitle?.trim() || '未命名文档'} - SangDocCraft`;
}