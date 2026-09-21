import { describe, expect, it } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import type { DocumentTheme } from '../types';
import { mergeThemePreservingDocumentText } from './themeSelection';

const currentTheme: DocumentTheme = {
  ...PRESET_THEMES[0],
  id: 'current',
  name: '当前主题',
  meta: {
    ...PRESET_THEMES[0].meta,
    title: '基于检索增强生成的问答系统研究',
    subtitle: '毕业设计论文',
    author: '张三',
    version: 'v2.1.0',
    department: '计算机学院',
    organization: '某某大学',
    date: '2026-09-01',
    number: 'DOC-2026-042',
  },
  cover: {
    ...PRESET_THEMES[0].cover,
    coverlist: [{ label: '指导教师', value: '李四' }],
  },
  header: { ...PRESET_THEMES[0].header, leftText: '论文页眉 · 内部资料', centerText: '  ', rightText: '' },
  footer: { ...PRESET_THEMES[0].footer, leftText: '', centerText: '第 {page} 页', rightText: '   ' },
};

const incomingTheme: DocumentTheme = { ...PRESET_THEMES[1], id: 'incoming', name: '新主题' };

describe('mergeThemePreservingDocumentText', () => {
  it('保留当前文档的封面与页眉页脚文本类信息', () => {
    const merged = mergeThemePreservingDocumentText(currentTheme, incomingTheme);

    expect(merged.meta.title).toBe('基于检索增强生成的问答系统研究');
    expect(merged.meta.subtitle).toBe('毕业设计论文');
    expect(merged.meta.author).toBe('张三');
    expect(merged.meta.version).toBe('v2.1.0');
    expect(merged.meta.department).toBe('计算机学院');
    expect(merged.meta.organization).toBe('某某大学');
    expect(merged.meta.date).toBe('2026-09-01');
    expect(merged.meta.number).toBe('DOC-2026-042');
    expect(merged.cover.coverlist).toEqual([{ label: '指导教师', value: '李四' }]);

    expect(merged.header.leftText).toBe('论文页眉 · 内部资料');
    expect(merged.footer.centerText).toBe('第 {page} 页');
  });

  it('替换主题的排版与配色等非文本类配置', () => {
    const merged = mergeThemePreservingDocumentText(currentTheme, incomingTheme);

    expect(merged.id).toBe('incoming');
    expect(merged.name).toBe('新主题');
    expect(merged.style).toEqual(incomingTheme.style);
    expect(merged.toc).toEqual(incomingTheme.toc);
    expect(merged.cover.coverStyle).toBe(incomingTheme.cover.coverStyle);
    expect(merged.cover.showCover).toBe(incomingTheme.cover.showCover);
    expect(merged.header.lineStyle).toBe(incomingTheme.header.lineStyle);
    expect(merged.header.logoUrl).toBe(incomingTheme.header.logoUrl);
    expect(merged.footer.pageNumberFormat).toBe(incomingTheme.footer.pageNumberFormat);
    expect(merged.footer.pageNumberPosition).toBe(incomingTheme.footer.pageNumberPosition);
  });

  it('当前值为空或仅空白时采用新主题的值', () => {
    const merged = mergeThemePreservingDocumentText(currentTheme, incomingTheme);

    expect(merged.header.centerText).toBe(incomingTheme.header.centerText);
    expect(merged.header.rightText).toBe(incomingTheme.header.rightText);
    expect(merged.footer.leftText).toBe(incomingTheme.footer.leftText);
    expect(merged.footer.rightText).toBe(incomingTheme.footer.rightText);
  });

  it('当前封面属性列表为空时采用新主题的列表', () => {
    const currentWithoutCoverList: DocumentTheme = { ...currentTheme, cover: { ...currentTheme.cover, coverlist: [] } };

    expect(mergeThemePreservingDocumentText(currentWithoutCoverList, incomingTheme).cover.coverlist)
      .toEqual(incomingTheme.cover.coverlist);

    const currentWithUndefinedFields: DocumentTheme = {
      ...currentTheme,
      meta: { ...currentTheme.meta, version: undefined, number: undefined },
      cover: { ...currentTheme.cover, coverlist: undefined },
    };
    const merged = mergeThemePreservingDocumentText(currentWithUndefinedFields, incomingTheme);
    expect(merged.meta.version).toBe(incomingTheme.meta.version);
    expect(merged.meta.number).toBe(incomingTheme.meta.number);
    expect(merged.cover.coverlist).toBe(incomingTheme.cover.coverlist);
  });
});
