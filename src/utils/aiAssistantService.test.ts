import { describe, expect, it, vi } from 'vitest';
import { getRegisteredThemes } from '../themes/themeRegistry';
import type { DocumentHistoryEntry, DocumentSettings, DocumentTheme } from '../types';
import { buildAiTools } from './aiAssistantService';

describe('AI assistant setting tools', () => {
  const createTools = (markdown: string) => {
    const theme = structuredClone(getRegisteredThemes()[0]);
    const settings: DocumentSettings = { historyEnabled: true, historyIdleMinutes: 10 };
    return buildAiTools({
      markdown,
      theme,
      settings,
      onUpdateMarkdown: () => undefined,
      onUpdateTheme: () => undefined,
      onUpdateSettings: () => undefined,
      onSetHistory: () => undefined,
      onStartDiffReview: session => Promise.resolve({ markdown: session.modifiedText, acceptedCount: 1, rejectedCount: 0, cancelled: false }),
      onCancelDiffReview: () => undefined,
    });
  };

  it('returns document size and outline without Markdown content', async () => {
    const markdown = '# 项目概述\n正文\n\n## 背景说明\n细节';
    const tools = createTools(markdown);
    const stateTool = tools.find(item => item.definition.function.name === 'get_document_state');

    const state = JSON.parse(await stateTool!.handler({})) as Record<string, unknown>;

    expect(state).toMatchObject({
      markdownLength: markdown.length,
      totalLines: 5,
      outline: [
        { level: 1, text: '项目概述', line: 1 },
        { level: 2, text: '背景说明', line: 4 },
      ],
    });
    expect(state).not.toHaveProperty('markdownPreview');
    expect(JSON.stringify(state)).not.toContain('正文');
  });

  it('returns only the lightweight Markdown summary fields', async () => {
    const tools = createTools('# 标题\n正文');
    const summaryTool = tools.find(item => item.definition.function.name === 'get_document_summary');

    expect(JSON.parse(await summaryTool!.handler({}))).toEqual({
      markdownLength: 7,
      totalLines: 2,
      historyEnabled: true,
      outline: [{ level: 1, text: '标题', line: 1 }],
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
      markdown,
      theme,
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      onUpdateMarkdown: () => undefined,
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
    const tools = buildAiTools({
      markdown: '# 标题',
      theme: structuredClone(getRegisteredThemes()[0]),
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      onUpdateMarkdown: () => undefined,
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
      markdown,
      theme,
      settings: { historyEnabled: true, historyIdleMinutes: 10 },
      onUpdateMarkdown: () => undefined,
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
    let settings: DocumentSettings = { historyEnabled: false, historyIdleMinutes: 10 };
    let history: unknown[] = [];
    const tools = buildAiTools({
      markdown: '# Test',
      theme,
      settings,
      onUpdateMarkdown: () => undefined,
      onUpdateTheme: update => {
        theme = typeof update === 'function' ? update(theme) : update;
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

    expect(theme.meta.title).toBe('企业级云原生中台系统架构设计说明书');
    expect(theme.meta.organization).toBe('Sang科技有限公司');
    expect(theme.meta).toMatchObject({ logo: '@images/img-logo-test', logoHeight: 56, coverListColumns: 2 });
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

    const stateTool = tools.find(item => item.definition.function.name === 'get_document_state');
    const state = JSON.parse(await stateTool!.handler({})) as Record<string, unknown>;
    expect(state).toMatchObject({
      meta: { title: '企业级云原生中台系统架构设计说明书', organization: 'Sang科技有限公司' },
      cover: { logo: '@images/img-logo-test', logoHeight: 56, coverListColumns: 2 },
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
      markdown: '# 标题\n正文',
      theme,
      settings,
      onUpdateMarkdown: () => undefined,
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

  it('groups the document state into meta, cover, header, footer, toc, color, style and watermark', async () => {
    const tools = createTools('# 标题');
    const stateTool = tools.find(item => item.definition.function.name === 'get_document_state')!;
    const state = JSON.parse(await stateTool.handler({})) as Record<string, unknown>;
    const style = state.style as Record<string, unknown>;

    expect(state).toMatchObject({
      markdownLength: 4,
      totalLines: 1,
      historyEnabled: true,
      outline: [{ level: 1, text: '标题', line: 1 }],
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
    expect(state).not.toHaveProperty('title');
    expect(state).not.toHaveProperty('primaryColor');
  });
});