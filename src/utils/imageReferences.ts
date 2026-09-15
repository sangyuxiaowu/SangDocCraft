import type { DocumentAssetScope, DocumentTheme } from '../types';

const INTERNAL_IMAGE_PATTERN = /@(images|library)\/([a-z0-9][a-z0-9-]{7,63})/gi;

export function collectImageReferences(markdown: string, theme: DocumentTheme): Set<string> {
  const references = new Set<string>();
  const content = `${markdown}\n${JSON.stringify(theme)}`;
  for (const match of content.matchAll(INTERNAL_IMAGE_PATTERN)) {
    references.add(`@${match[1].toLowerCase()}/${match[2]}`);
  }
  return references;
}

export function isImageReferenced(
  id: string,
  scope: DocumentAssetScope,
  markdown: string,
  theme: DocumentTheme,
): boolean {
  const directory = scope === 'library' ? 'library' : 'images';
  return collectImageReferences(markdown, theme).has(`@${directory}/${id}`);
}