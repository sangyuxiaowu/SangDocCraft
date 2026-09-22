import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { getRegisteredThemes } from '../themes/themeRegistry';
import type { DocumentHistoryEntry, DocumentMeta, DocumentSettings, DocumentTheme } from '../types';
import { buildAiTools } from './aiAssistantService';

const defaultMeta: DocumentMeta = {
  ...DEFAULT_DOCUMENT_META,
  title: '测试文档',
  department: '测试部门',
};
const staticMetaContext = {
  getMeta: () => defaultMeta,
  onUpdateMeta: () => undefined,
};

describe('AI assistant setting tools', () => {
  const createTools = (markdown: string, sessions: string[] = []) => {
    let theme = structuredClone(getRegisteredThemes()[0]);
    let meta = structuredClone(defaultMeta);
    const settings: DocumentSettings = { historyEnabled: true, historyIdleMinutes: 10 };
    return buildAiTools({
      markdown,
      getMeta: () => meta,
      getTheme: () => theme,
      settings,
      onUpdateTheme: update => { theme = typeof update === 'function' ? update(theme) : update; },
      onUpdateMeta: update => { meta = typeof update === 'function' ? update(meta) : update; },
      onUpdateSettings: () => undefined,
      onSetHistory: () => undefined,
      onStartDiffReview: session => {
        sessions.push(session.modifiedText);
        return Promise.resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false });
      },
      onCancelDiffReview: () => undefined,
    });
  };

  it('returns document summary with meta but without Markdown content', async () => {
    const markdown = '# 项目概述\n正文\n\n## 背景说明\n细节';
    const tools = createTools(markdown);
    const summaryTool = tools.find(item => item.definition.function.name === 'get_document_summary');

    const summary = JSON.parse(await summaryTool!.handler({})) as Record<string, unknown>;

    expect(summary).toMatchObject({
      markdownLength: markdown.length,
      totalLines: 5,
      outline: [
        { level: 1, text: '项目概述', line: 1 },
        { level: 2, text: '背景说明', line: 4 },
      ],
      meta: { title: expect.any(String), department: expect.any(String) },
    });
    expect(summary).not.toHaveProperty('markdownPreview');
    expect(JSON.stringify(summary)).not.toContain('正文');
  });

  it('returns lightweight Markdown summary fields and meta', async () => {
    const tools = createTools('# 标题\n正文');
    const summaryTool = tools.find(item => item.definition.function.name === 'get_document_summary');

    expect(JSON.parse(await summaryTool!.handler({}))).toMatchObject({
      markdownLength: 7,
      totalLines: 2,
      historyEnabled: true,
      outline: [{ level: 1, text: '标题', line: 1 }],
      meta: expect.any(Object),
    });
  });

  it('reads Markdown by line range or complete heading section', async () => {
    const markdown = '# 项目概述\n概述正文\n## 背景说明\n背景正文\n### 子项\n子项正文\n## 指标\n指标正文';
    const tools = createTools(markdown);
    const contentTool = tools.find(item => item.definition.function.name === 'get_markdown_content');

    expect(JSON.parse(await contentTool!.handler({ offset: 2, limit: 2 }))).toMatchObject({
      startLine: 2,
      endLine: 3,
      totalLines: 8,
      content: '概述正文\n## 背景说明',
    });
    expect(JSON.parse(await contentTool!.handler({ heading: '背景说明', includeLineNumbers: true }))).toMatchObject({
      startLine: 3,
      endLine: 6,
      content: '3: ## 背景说明\n4: 背景正文\n5: ### 子项\n6: 子项正文',
    });
  });

  it('applies multiple Markdown operations in one review against the same baseline', async () => {
    const markdown = '# 标题\n第一行\n第二行';
    const sessions: string[] = [];
    const theme = structuredClone(getRegisteredThemes()[0]);
    const tools = buildAiTools({
      ...staticMetaContext,
      markdown,
      getTheme: () => theme,
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      onUpdateTheme: () => undefined,
      onUpdateSettings: () => undefined,
      onSetHistory: () => undefined,
      onStartDiffReview: session => {
        sessions.push(session.modifiedText);
        return Promise.resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false });
      },
      onCancelDiffReview: () => undefined,
    });
    const editTool = tools.find(item => item.definition.function.name === 'edit_markdown_content')!;

    await editTool.handler({
      operations: [
        { op: 'replace', content: '替换一\n替换二', range: { startLine: 2, endLine: 2 } },
        { op: 'replace', content: '替换三', range: { startLine: 3, endLine: 3 } },
        { op: 'append', content: '追加行' },
      ],
    });

    expect(sessions).toEqual(['# 标题\n替换一\n替换二\n替换三\n追加行']);
    await expect(editTool.handler({ operations: [{ op: 'replace', content: '无范围' }] }))
      .rejects.toMatchObject({ kind: 'invalid_arguments' });
    await expect(editTool.handler({ operations: [
      { op: 'replace', content: 'A', range: { startLine: 2, endLine: 3 } },
      { op: 'replace', content: 'B', range: { startLine: 3, endLine: 3 } },
    ] })).rejects.toThrow('replace 区间不可重叠');
    await expect(editTool.handler({ operations: [
      { op: 'full', content: '# 新文档' },
      { op: 'append', content: '追加行' },
    ] })).rejects.toThrow('full 操作只能单独使用');
  });

  it('keeps a Markdown tool pending until its review finishes', async () => {
    let finishReview: (() => void) | undefined;
    const theme = structuredClone(getRegisteredThemes()[0]);
    const tools = buildAiTools({
      ...staticMetaContext,
      markdown: '# 标题',
      getTheme: () => theme,
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      onUpdateTheme: () => undefined,
      onUpdateSettings: () => undefined,
      onSetHistory: () => undefined,
      onStartDiffReview: session => new Promise(resolve => {
        finishReview = () => resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false });
      }),
      onCancelDiffReview: () => undefined,
    });
    const editTool = tools.find(item => item.definition.function.name === 'edit_markdown_content')!;
    const result = editTool.handler({ operations: [{ op: 'append', content: '第一项' }] });
    const settled = vi.fn();
    void result.then(settled);

    await vi.waitFor(() => expect(finishReview).toBeDefined());
    expect(settled).not.toHaveBeenCalled();

    finishReview!();
    await expect(result).resolves.toContain('正文审查已完成');
  });

  it('requires unique exact replacement unless global replacement is explicit', async () => {
    const markdown = '# 标题\n重复文本\n中间\n重复文本';
    const sessions: string[] = [];
    const theme = structuredClone(getRegisteredThemes()[0]);
    const tools = buildAiTools({
      ...staticMetaContext,
      markdown,
      getTheme: () => theme,
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      onUpdateTheme: () => undefined,
      onUpdateSettings: () => undefined,
      onSetHistory: () => undefined,
      onStartDiffReview: session => {
        sessions.push(session.modifiedText);
        return Promise.resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false });
      },
      onCancelDiffReview: () => undefined,
    });
    const replaceTool = tools.find(item => item.definition.function.name === 'replace_markdown_section')!;

    await expect(replaceTool.handler({ oldText: '重复文本', newText: '新文本' }))
      .rejects.toThrow('候选位置：第 2 行第 1 列；第 4 行第 1 列');
    await replaceTool.handler({ oldText: '重复文本', newText: '新文本', replaceAll: true });

    expect(sessions).toEqual(['# 标题\n新文本\n中间\n新文本']);
  });

  it('preserves all changes when multiple setting tools run in sequence', async () => {
    let theme: DocumentTheme = structuredClone(getRegisteredThemes()[0]);
    let meta = structuredClone(defaultMeta);
    let settings: DocumentSettings = { historyEnabled: false, historyIdleMinutes: 10 };
    let history: unknown[] = [];
    const tools = buildAiTools({
      markdown: '# Test',
      getMeta: () => meta,
      getTheme: () => theme,
      settings,
      onUpdateTheme: update => {
        theme = typeof update === 'function' ? update(theme) : update;
      },
      onUpdateMeta: update => {
        meta = typeof update === 'function' ? update(meta) : update;
      },
      onUpdateSettings: update => {
        settings = typeof update === 'function' ? update(settings) : update;
      },
      onSetHistory: update => {
        history = typeof update === 'function' ? update(history) : update;
      },
      onStartDiffReview: session => Promise.resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false }),
      onCancelDiffReview: () => undefined,
    });
    const run = async (name: string, args: Record<string, unknown>) => {
      const tool = tools.find(item => item.definition.function.name === name);
      expect(tool).toBeDefined();
      await tool!.handler(args);
    };

    await run('update_document_meta', {
      title: '企业级云原生中台系统架构设计说明书',
      organization: 'Sang科技有限公司',
      version: 'v1.2.0',
      logoUrl: '@images/img-logo-test',
      logoHeight: 56,
      coverListColumns: 2,
    });
    await run('update_document_style', {
      primaryColor: '#0b2545',
      lineHeight: 1.8,
      h1PageBreak: true,
      latinFontFamily: 'Arial',
      paginationMode: 'manual',
      bulletStyle: 'arrow',
      headingFonts: { h1: { fontSize: 30, marginBefore: 44 } },
      imageConfig: { borderStyle: 'card', captionAlign: 'left' },
      tableCaptionConfig: { captionPosition: 'bottom', numberPrefix: '表格 ' },
    });
    await run('update_header_footer_config', {
      headerLeftText: 'Sang科技有限公司 · 技术交付文档',
      headerLineStyle: 'double',
      headerHideOnCover: false,
      headerLogoOpacity: 0.6,
      footerLeftText: 'DOC-ARCH-2026-018 · v1.2.0',
      footerCenterText: '内部评审',
      footerHideOnCover: false,
    });
    await run('update_toc_config', {
      maxDepth: 3,
      headingNumbering: 'decimal',
      titleCenter: true,
      titleStyle: 'minimal',
      showPageNumbers: false,
      titleOnEveryPage: true,
      titleFont: { fontSize: 26, bold: false, marginAfter: 18, unknownField: 'ignored' },
      levelStyles: [{ fontSize: 15 }, undefined, { bold: true, paddingLeft: 48 }],
    });

    expect(meta.title).toBe('企业级云原生中台系统架构设计说明书');
    expect(meta.organization).toBe('Sang科技有限公司');
    expect(theme).not.toHaveProperty('meta');
    expect(theme.cover).toMatchObject({ logoUrl: '@images/img-logo-test', logoHeight: 56, coverListColumns: 2 });
    expect(theme.style).toMatchObject({
      primaryColor: '#0b2545',
      lineHeight: 1.8,
      h1PageBreak: true,
      latinFontFamily: 'Arial',
      paginationMode: 'manual',
      bulletStyle: 'arrow',
      headingFonts: { h1: { fontSize: 30, marginBefore: 44 } },
      imageConfig: { borderStyle: 'card', captionAlign: 'left' },
      tableCaptionConfig: { captionPosition: 'bottom', numberPrefix: '表格 ' },
    });
    expect(theme.header).toMatchObject({
      leftText: 'Sang科技有限公司 · 技术交付文档',
      lineStyle: 'double',
      hideOnCover: false,
      logoOpacity: 0.6,
    });
    expect(theme.footer).toMatchObject({
      leftText: 'DOC-ARCH-2026-018 · v1.2.0',
      centerText: '内部评审',
      hideOnCover: false,
    });
    expect(theme.toc).toMatchObject({
      maxDepth: 3,
      headingNumbering: 'decimal',
      titleCenter: true,
      titleStyle: 'minimal',
      showPageNumbers: false,
      titleOnEveryPage: true,
      titleFont: { fontFamily: 'inherit', fontSize: 26, bold: false, marginBefore: 0, marginAfter: 18 },
      levelStyles: [
        { fontSize: 15, bold: true, paddingLeft: 0 },
        { fontSize: 13, paddingLeft: 20 },
        { fontSize: 12, bold: true, paddingLeft: 48 },
        { fontSize: 12, paddingLeft: 54 },
      ],
    });

    const configTool = tools.find(item => item.definition.function.name === 'get_document_config');
    const config = JSON.parse(await configTool!.handler({ types: ['meta', 'cover', 'color', 'style'] })) as Record<string, unknown>;
    expect(config).toMatchObject({
      meta: { title: '企业级云原生中台系统架构设计说明书', organization: 'Sang科技有限公司' },
      cover: { logoUrl: '@images/img-logo-test', logoHeight: 56, coverListColumns: 2 },
      color: { primaryColor: '#0b2545' },
      style: { lineHeight: 1.8, latinFontFamily: 'Arial', paginationMode: 'manual' },
    });

    const tocTool = tools.find(item => item.definition.function.name === 'update_toc_config');
    const tocProperties = tocTool!.definition.function.parameters.properties as Record<string, unknown>;
    expect(tocProperties).toHaveProperty('titleCenter');
    expect(tocProperties).toHaveProperty('titleStyle');
    expect(tocProperties).toHaveProperty('showPageNumbers');
    expect(tocProperties).toHaveProperty('titleFont');
    expect(tocProperties).toHaveProperty('levelStyles');
  });

  it('returns success after the requested watermark fields match', async () => {
    const tools = createTools('# Test');
    const styleTool = tools.find(item => item.definition.function.name === 'update_document_style')!;

    const result = await styleTool.handler({
      watermark: {
        show: true,
        type: 'text',
        text: '机密资料',
        fontSize: 40,
        color: '#dc2626',
        opacity: 0.11,
        rotate: 45,
        layout: 'repeat',
        repeatGap: 155,
        hideOnCover: false,
      },
    });

    expect(result).toBe('更新成功');
  });

  it('returns success after requested header fields match', async () => {
    const tools = createTools('# Test');
    const headerFooterTool = tools.find(item => item.definition.function.name === 'update_header_footer_config')!;

    await expect(headerFooterTool.handler({ headerLeftText: '内部资料' }))
      .resolves.toBe('更新成功');
  });

  it('reports success for partial TOC updates and ignores fields that were not requested', async () => {
    const tools = createTools('# Test');
    const tocTool = tools.find(item => item.definition.function.name === 'update_toc_config')!;

    await expect(tocTool.handler({
      levelStyles: [{ fontSize: 15 }, undefined, { bold: true, paddingLeft: 48 }],
      titleFont: { fontSize: 26, unknownFontField: 'ignored' },
      unknownTopLevelField: 'ignored',
    })).resolves.toBe('更新成功');
  });

  it('snapshots the latest theme and skips history when Markdown is unchanged', async () => {
    let theme: DocumentTheme = structuredClone(getRegisteredThemes()[0]);
    let settings: DocumentSettings = { historyEnabled: false, historyIdleMinutes: 10 };
    let history: DocumentHistoryEntry[] = [];
    const tools = buildAiTools({
      ...staticMetaContext,
      markdown: '# 标题\n正文',
      getTheme: () => theme,
      settings,
      onUpdateTheme: update => { theme = typeof update === 'function' ? update(theme) : update; },
      onUpdateSettings: update => { settings = typeof update === 'function' ? update(settings) : update; },
      onSetHistory: update => { history = typeof update === 'function' ? update(history) : update; },
      onStartDiffReview: session => Promise.resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false }),
      onCancelDiffReview: () => undefined,
    });
    const styleTool = tools.find(item => item.definition.function.name === 'update_document_style')!;
    const editTool = tools.find(item => item.definition.function.name === 'edit_markdown_content')!;

    await expect(editTool.handler({ operations: [{ op: 'replace', content: '正文', range: { startLine: 2, endLine: 2 } }] }))
      .resolves.toBe('正文内容与原文档完全一致，无需进行变更。');
    expect(settings.historyEnabled).toBe(false);
    expect(history).toEqual([]);

    await styleTool.handler({ primaryColor: '#0b2545' });
    await editTool.handler({ operations: [{ op: 'replace', content: '改写后的正文', range: { startLine: 2, endLine: 2 } }] });

    expect(settings.historyEnabled).toBe(true);
    expect(history).toHaveLength(1);
    expect(history[0].theme.style.primaryColor).toBe('#0b2545');
    expect(history[0].markdown).toBe('# 标题\n正文');
  });

  it('returns selected document config sections and supports all', async () => {
    const tools = createTools('# 标题');
    const configTool = tools.find(item => item.definition.function.name === 'get_document_config')!;
    const config = JSON.parse(await configTool.handler({ types: ['all'] })) as Record<string, unknown>;
    const style = config.style as Record<string, unknown>;

    expect(config).toMatchObject({
      meta: { title: expect.any(String), department: expect.any(String) },
      cover: { showCover: expect.any(Boolean), coverStyle: expect.any(String) },
      header: { show: expect.any(Boolean), lineStyle: expect.any(String) },
      footer: { show: expect.any(Boolean), pageNumberFormat: expect.any(String) },
      toc: { maxDepth: expect.any(Number), levelStyles: expect.any(Array) },
      color: {
        primaryColor: expect.any(String),
        accentColor: expect.any(String),
        textColor: expect.any(String),
        backgroundColor: expect.any(String),
        coverBgColor: expect.any(String),
      },
      watermark: null,
    });
    expect(style).toMatchObject({ fontFamily: expect.any(String), fontSize: expect.any(Number), h1Style: expect.any(String) });
    expect(style).not.toHaveProperty('primaryColor');
    expect(style).not.toHaveProperty('watermark');
    expect(config).not.toHaveProperty('title');
    expect(config).not.toHaveProperty('primaryColor');

    const selected = JSON.parse(await configTool.handler({ types: ['meta', 'watermark'] })) as Record<string, unknown>;
    expect(selected).toEqual({ meta: expect.any(Object), watermark: null });
  });

  it('supports regex replacement with capture groups when useRegex is set', async () => {
    const markdown = '# 标题\n版本 v1.0.0 于 2026-01-01 发布\n版本 v2.3.1 于 2026-05-20 发布';
    const sessions: string[] = [];
    const replaceTool = createTools(markdown, sessions)
      .find(item => item.definition.function.name === 'replace_markdown_section')!;

    await expect(replaceTool.handler({ oldText: 'v\\d+\\.\\d+\\.\\d+', newText: 'v9.9.9', useRegex: true }))
      .rejects.toThrow('匹配到 2 处');
    expect(sessions).toEqual([]);

    await replaceTool.handler({
      oldText: '版本 (v\\d+\\.\\d+\\.\\d+)',
      newText: '版本 $1（已归档）',
      useRegex: true,
      replaceAll: true,
    });
    expect(sessions).toEqual(['# 标题\n版本 v1.0.0（已归档） 于 2026-01-01 发布\n版本 v2.3.1（已归档） 于 2026-05-20 发布']);

    await expect(replaceTool.handler({ oldText: '([', newText: 'x', useRegex: true }))
      .rejects.toThrow('不是合法的正则表达式');
    await expect(replaceTool.handler({ oldText: 'x*', newText: 'y', useRegex: true }))
      .rejects.toThrow('不能匹配空字符串');
  });

  it('keeps dollar signs literal in plain text replacement', async () => {
    const sessions: string[] = [];
    const replaceTool = createTools('# 标题\nE = mc^2', sessions)
      .find(item => item.definition.function.name === 'replace_markdown_section')!;

    await replaceTool.handler({ oldText: 'E = mc^2', newText: '$$\nE = mc^2\n$$\n' });

    expect(sessions).toEqual(['# 标题\n$$\nE = mc^2\n$$\n']);
  });

  it('applies theme updates on top of the latest theme instead of a stale snapshot', async () => {
    let theme: DocumentTheme = structuredClone(getRegisteredThemes()[0]);
    const tools = buildAiTools({
      ...staticMetaContext,
      markdown: '# Test',
      getTheme: () => theme,
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      onUpdateTheme: update => { theme = typeof update === 'function' ? update(theme) : update; },
      onUpdateSettings: () => undefined,
      onSetHistory: () => undefined,
      onStartDiffReview: session => Promise.resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false }),
      onCancelDiffReview: () => undefined,
    });
    const styleTool = tools.find(item => item.definition.function.name === 'update_document_style')!;

    // 模拟用户在 AI 本轮进行中手动改了水印：工具必须以实时主题为基线，不能把它覆盖回旧值。
    theme = {
      ...theme,
      style: {
        ...theme.style,
        watermark: {
          show: true, type: 'text', text: '用户手改', fontSize: 40, color: '#dc2626',
          opacity: 0.1, rotate: 45, layout: 'repeat', repeatGap: 120, hideOnCover: false,
        },
      },
    };

    await expect(styleTool.handler({ lineHeight: 1.9 })).resolves.toBe('更新成功');
    expect(theme.style.lineHeight).toBe(1.9);
    expect(theme.style.watermark?.text).toBe('用户手改');
  });

  it('validates enum values and numeric ranges declared in the field spec', async () => {
    const tools = createTools('# Test');
    const styleTool = tools.find(item => item.definition.function.name === 'update_document_style')!;
    const headerFooterTool = tools.find(item => item.definition.function.name === 'update_header_footer_config')!;

    await expect(styleTool.handler({ h1Style: 'underlined' }))
      .rejects.toThrow('可选值：underline、accent-block、badge、minimal');
    await expect(styleTool.handler({ fontSize: -2 })).rejects.toThrow('fontSize 不能小于 1');
    await expect(styleTool.handler({ watermark: { opacity: 1.5 } })).rejects.toThrow('opacity 不能大于 1');
    await expect(headerFooterTool.handler({ headerLogoOpacity: 2 })).rejects.toThrow('headerLogoOpacity 不能大于 1');
    await expect(styleTool.handler({ lineHeight: 1.7 })).resolves.toBe('更新成功');

    // schema 与校验同源：枚举与范围会同时出现在下发给模型的 parameters 里
    const styleProperties = styleTool.definition.function.parameters.properties as Record<string, Record<string, unknown>>;
    expect(styleProperties.h1Style).toMatchObject({ type: 'string', enum: ['underline', 'accent-block', 'badge', 'minimal'] });
    expect(styleProperties.lineHeight).toMatchObject({ type: 'number', minimum: 0.5, maximum: 5 });
    expect(styleProperties.watermark).toMatchObject({
      type: 'object',
      properties: { opacity: { type: 'number', minimum: 0, maximum: 1 } },
    });
  });

  it('drops unknown keys of nested config objects instead of persisting them', async () => {
    let theme: DocumentTheme = structuredClone(getRegisteredThemes()[0]);
    const tools = buildAiTools({
      ...staticMetaContext,
      markdown: '# Test',
      getTheme: () => theme,
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      onUpdateTheme: update => { theme = typeof update === 'function' ? update(theme) : update; },
      onUpdateSettings: () => undefined,
      onSetHistory: () => undefined,
      onStartDiffReview: session => Promise.resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false }),
      onCancelDiffReview: () => undefined,
    });
    const styleTool = tools.find(item => item.definition.function.name === 'update_document_style')!;

    await expect(styleTool.handler({
      watermark: { show: true, text: '机密', opacity: 0.2, typoField: 'should-be-dropped' },
    })).resolves.toBe('更新成功');

    expect(theme.style.watermark).toMatchObject({ show: true, text: '机密', opacity: 0.2 });
    expect(theme.style.watermark).not.toHaveProperty('typoField');
  });

  it('reports invalid enum values instead of a misleading incomplete update', async () => {
    const tools = createTools('# Test');
    const tocTool = tools.find(item => item.definition.function.name === 'update_toc_config')!;

    // 旧实现把 '' 当成「未提供」而不写入，却仍参与校验，最终报出误导性的「更新未完成」
    await expect(tocTool.handler({ titleStyle: '' })).rejects.toThrow('titleStyle 取值非法');
    await expect(tocTool.handler({ title: '' })).resolves.toBe('更新成功');
  });
});