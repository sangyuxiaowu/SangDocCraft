import type { ImageStyleConfig, StyleConfig } from '../types';

export type DocumentColors = Partial<Pick<StyleConfig, 'primaryColor' | 'accentColor' | 'textColor'>> & {
  imageConfig?: Pick<ImageStyleConfig, 'borderColor'>;
};

export function getDocumentColorVariables(style: DocumentColors = {}) {
  return {
    '--primary-color': style.primaryColor || '#0f172a',
    '--accent-color': style.accentColor || '#2563eb',
    '--text-color': style.textColor || '#334155',
    '--img-border-color': style.imageConfig?.borderColor || '#cbd5e1',
  };
}