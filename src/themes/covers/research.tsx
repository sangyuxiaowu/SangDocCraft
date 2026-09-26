import type { CoverTemplatePlugin } from '../contracts';
import { renderDocx, renderHtml, renderPreview, renderThumbnail } from './businessLayout';

export const researchCoverPlugin: CoverTemplatePlugin = {
  id: 'research', name: '🔬调研实验报告', description: '企业签审式封面、竖排主标题与双栏信息',
  defaultLogoHeight: 64, defaultCoverListColumns: 2,
  renderThumbnail: () => renderThumbnail(false, true), renderPreview: (context) => renderPreview(context, false, true),
  renderHtml: (context) => renderHtml(context, false, true), renderDocx: (context) => renderDocx(context, false, true),
};