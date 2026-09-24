import { describe, expect, it } from 'vitest';
import { getPageSections, resolveCoverList, resolveDynamicText } from './dynamicFields';
import type { DocumentMeta } from '../types';

const meta: DocumentMeta = {
  title: '报告', subtitle: '摘要', author: '甲', department: '研发',
  organization: '公司', date: '2026-09-24', number: 'NO-1', version: '1.0',
};

describe('dynamic fields', () => {
  it('resolves meta in cover values and preserves unknown references and labels', () => {
    expect(resolveCoverList([
      { label: '@author', value: '@title' }, { label: '编号', value: '@number' },
      { label: '混合', value: '@title / @number' }, { label: '章节', value: '@h1' },
    ], meta)).toEqual([
      { label: '@author', value: '报告' }, { label: '编号', value: 'NO-1' },
      { label: '混合', value: '@title / @number' }, { label: '章节', value: '@h1' },
    ]);
  });

  it('tracks chapter headings across pages and falls back from h2 to h1', () => {
    const sections = getPageSections(['# 第一章\n正文', '续页', '## 第二节\n正文', '# 第二章\n正文']);
    expect(sections).toEqual([
      { h1: '第一章', h2: '' }, { h1: '第一章', h2: '' },
      { h1: '第一章', h2: '第二节' }, { h1: '第二章', h2: '' },
    ]);
    expect(resolveDynamicText('@h1 / @h2 / @title', meta, sections[1])).toBe('@h1 / @h2 / @title');
    expect(resolveDynamicText('@h2', meta, sections[1])).toBe('第一章');
    expect(resolveDynamicText('@h2', meta, sections[2])).toBe('第二节');
    expect(resolveDynamicText('@h1', meta, { h1: '', h2: '' })).toBe('');
    expect(resolveDynamicText(' @title', meta, sections[1])).toBe(' @title');
    expect(resolveDynamicText('@title 其他文字', meta, sections[1])).toBe('@title 其他文字');
    expect(resolveDynamicText('@unknown', meta, sections[1])).toBe('@unknown');
  });
});