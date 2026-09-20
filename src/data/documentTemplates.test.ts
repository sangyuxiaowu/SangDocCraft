import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATE_THEME_ID, DOCUMENT_TEMPLATES, resolveTemplateTheme } from './documentTemplates';
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

  it('会议纪要模板关闭封面与目录，并居中一级标题', () => {
    const template = DOCUMENT_TEMPLATES.find((item) => item.id === 'meeting-minutes');
    expect(template).toBeDefined();
    expect(template?.coverConfig?.showCover).toBe(false);
    expect(template?.tocConfig?.show).toBe(false);
    expect(template?.styleConfig?.h1Center).toBe(true);
  });
});

describe('resolveTemplateTheme', () => {
  const baseTheme = PRESET_THEMES.find((theme) => theme.id === 'governmental-standard')!;
  const meetingMinutes = DOCUMENT_TEMPLATES.find((template) => template.id === 'meeting-minutes')!;

  it('应用模板差异项：关闭封面与目录、一级标题居中', () => {
    const resolved = resolveTemplateTheme(meetingMinutes, baseTheme);
    expect(resolved.meta.showCover).toBe(false);
    expect(resolved.toc.show).toBe(false);
    expect(resolved.style.h1Center).toBe(true);
  });

  it('模板未声明的字段完全沿用推荐主题', () => {
    const resolved = resolveTemplateTheme(meetingMinutes, baseTheme);
    expect(resolved.style).toEqual({ ...baseTheme.style, h1Center: true });
    expect(resolved.toc).toEqual({ ...baseTheme.toc, show: false });
    expect(resolved.header).toEqual(baseTheme.header);
    expect(resolved.footer).toEqual(baseTheme.footer);
    expect(resolved.meta.title).toBe(meetingMinutes.coverConfig?.title);
  });

  it('未声明差异项的模板保持推荐主题的封面与目录配置', () => {
    const blank = DOCUMENT_TEMPLATES.find((template) => template.id === 'blank')!;
    const theme = PRESET_THEMES.find((item) => item.id === blank.recommendedThemeId)!;
    const resolved = resolveTemplateTheme(blank, theme);
    expect(resolved.meta.showCover).toBe(theme.meta.showCover);
    expect(resolved.toc).toEqual(theme.toc);
    expect(resolved.style).toEqual(theme.style);
  });
});
