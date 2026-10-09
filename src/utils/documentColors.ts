import type { ImageStyleConfig, StyleConfig } from '../types';

export type DocumentColors = Partial<Pick<StyleConfig,
  'primaryColor' |
  'accentColor' |
  'textColor' |
  'textSecondaryColor' |
  'textMutedColor' |
  'borderColor' |
  'borderLightColor'
>> & {
  imageConfig?: Pick<ImageStyleConfig, 'borderColor'>;
};

export function getDocumentColorVariables(style: DocumentColors = {}) {
  return {
    '--primary-color': style.primaryColor || '#0f172a',
    '--accent-color': style.accentColor || '#2563eb',
    '--text-color': style.textColor || '#334155',
    '--text-secondary': style.textSecondaryColor || '#64748b',
    '--text-muted': style.textMutedColor || '#94a3b8',
    '--border-color': style.borderColor || '#cbd5e1',
    '--border-light': style.borderLightColor || '#e2e8f0',
    '--img-border-color': style.imageConfig?.borderColor || '#cbd5e1',
  };
}