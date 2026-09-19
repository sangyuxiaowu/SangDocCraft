import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE_THEME_ID, DOCUMENT_TEMPLATES } from './documentTemplates';
import { PRESET_THEMES } from './presetThemes';

const presetThemeIds = new Set(PRESET_THEMES.map((theme) => theme.id));

describe('DOCUMENT_TEMPLATES', () => {
  it('模板 id 全局唯一', () => {
    const ids = DOCUMENT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(DOCUMENT_TEMPLATES.map((template) => [template.id, template.recommendedThemeId]))(
    '模板 %s 指向真实存在的内置主题 %s',
    (_id, themeId) => {
      expect(presetThemeIds.has(themeId)).toBe(true);
    },
  );

  it('各模板使用互不相同的推荐主题，避免新建文档排版千篇一律', () => {
    const themeIds = DOCUMENT_TEMPLATES.map((template) => template.recommendedThemeId);
    expect(new Set(themeIds).size).toBe(themeIds.length);
  });

  it('兜底主题存在于内置主题中', () => {
    expect(presetThemeIds.has(DEFAULT_TEMPLATE_THEME_ID)).toBe(true);
  });

  it('每个模板都带有独立的 Markdown 正文与封面标题', () => {
    for (const template of DOCUMENT_TEMPLATES) {
      expect(template.markdown.trim().length).toBeGreaterThan(0);
      expect(template.coverConfig?.title?.trim()).toBeTruthy();
    }
  });
});
