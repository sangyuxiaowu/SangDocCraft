import { EditorView } from '@codemirror/view';

export interface EditorTypography {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

export function createEditorTheme(isDark: boolean, typography: EditorTypography) {
  return EditorView.theme({
    '&': {
      height: '100%',
      color: isDark ? '#d4d4d8' : '#1e293b',
      backgroundColor: isDark ? '#0a0a0a' : '#ffffff',
      '--editor-heading-text': isDark ? '#93c5fd' : '#1d4ed8',
      '--editor-keyword': isDark ? '#f9a8d4' : '#be185d',
      '--editor-string': isDark ? '#86efac' : '#166534',
      '--editor-number': isDark ? '#fcd34d' : '#92400e',
      '--editor-muted': isDark ? '#a1a1aa' : '#64748b',
      '--editor-tag': isDark ? '#67e8f9' : '#0e7490',
      '--editor-property': isDark ? '#fdba74' : '#9a3412',
      '--editor-link': isDark ? '#93c5fd' : '#2563eb',
    },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: typography.fontFamily,
      fontSize: `${typography.fontSize}px`,
      lineHeight: String(typography.lineHeight),
    },
    '.cm-content': { padding: '16px 0', caretColor: isDark ? '#f4f4f5' : '#18181b' },
    '.cm-line': { padding: '0 16px', overflowWrap: 'anywhere' },
    '.cm-gutters': {
      backgroundColor: isDark ? '#121212' : '#f8fafc',
      color: isDark ? '#71717a' : '#64748b',
      borderRight: `1px solid ${isDark ? '#27272a' : '#e2e8f0'}`,
    },
    '.cm-lineNumbers .cm-gutterElement': { minWidth: '3ch', padding: '0 8px' },
    '.cm-foldGutter .cm-gutterElement': { padding: '0 5px', cursor: 'pointer' },
    '.cm-activeLineGutter': { color: isDark ? '#e4e4e7' : '#0f172a', backgroundColor: isDark ? '#27272a' : '#e2e8f0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: isDark ? '#f4f4f5' : '#18181b' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: isDark ? '#1e40af80' : '#bfdbfe',
    },
    '.cm-heading-line': { borderLeft: '2px solid transparent' },
    '.cm-heading-1': { backgroundColor: isDark ? '#17255470' : '#eff6ff', borderLeftColor: '#3b82f6' },
    '.cm-heading-2': { backgroundColor: isDark ? '#052e1670' : '#f0fdf4', borderLeftColor: '#22c55e' },
    '.cm-heading-3': { backgroundColor: isDark ? '#42200670' : '#fffbeb', borderLeftColor: '#f59e0b' },
    '.cm-heading-4, .cm-heading-5, .cm-heading-6': { backgroundColor: isDark ? '#27272a70' : '#f4f4f5', borderLeftColor: '#a1a1aa' },
    '.cm-foldPlaceholder': {
      backgroundColor: isDark ? '#27272a' : '#f1f5f9',
      border: `1px solid ${isDark ? '#3f3f46' : '#cbd5e1'}`,
      color: isDark ? '#a1a1aa' : '#475569',
      borderRadius: '3px',
      padding: '0 6px',
      marginLeft: '8px',
      cursor: 'pointer',
    },
    '.cm-placeholder': { color: isDark ? '#71717a' : '#94a3b8' },
  }, { dark: isDark });
}