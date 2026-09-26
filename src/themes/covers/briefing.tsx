import type { CoverTemplatePlugin } from '../contracts';
import { renderDocx, renderHtml, renderPreview, renderThumbnail } from './businessLayout';

export const briefingCoverPlugin: CoverTemplatePlugin = {
  id: 'briefing', name: '🧑‍💼商务简报', description: '左对齐标题、细线分区与双栏信息',
  defaultLogoHeight: 64, defaultCoverListColumns: 2,
  renderThumbnail: () => renderThumbnail(true), renderPreview: (context) => renderPreview(context, true),
  renderHtml: (context) => renderHtml(context, true), renderDocx: (context) => renderDocx(context, true),
};