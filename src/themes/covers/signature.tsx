import type { CoverTemplatePlugin } from '../contracts';
import { renderDocx, renderHtml, renderPreview, renderThumbnail } from './businessLayout';

export const signatureCoverPlugin: CoverTemplatePlugin = {
  id: 'signature', name: '🏢企业签审', description: '左上标志、双栏签审与落款',
  defaultLogoHeight: 64, defaultCoverListColumns: 2,
  renderThumbnail: () => renderThumbnail(), renderPreview: (context) => renderPreview(context),
  renderHtml: (context) => renderHtml(context), renderDocx: (context) => renderDocx(context),
};