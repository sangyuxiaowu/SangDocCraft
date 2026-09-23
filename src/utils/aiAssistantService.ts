import { 
  DocumentSettings, 
  DocumentTheme,
  DocumentMeta,
  CoverConfig,
  HeaderConfig,
  FooterConfig,
  TocConfig,
  StyleConfig,
  TocLevelStyle
} from '../types';
import { 
  AiToolRuntime, 
  AiToolExecutionError,
  DiffReviewSession 
} from '../types/ai';
import type { SetStateAction } from 'react';
import { AI_TOOL_DEFINITIONS } from './aiToolDefinitions';
import { 
  FOOTER_FIELDS,
  HEADER_FIELDS,
  HEADING_FONT_FIELDS,
  IMAGE_CONFIG_FIELDS,
  META_FIELDS,
  STYLE_FIELDS,
  TABLE_CAPTION_FIELDS,
  TOC_FIELDS,
  TOC_LEVEL_FONT_FIELDS,
  WATERMARK_FIELDS,
  pickSubFields,
  readFieldValue,
  type ScalarFieldSpec,
  type SubFieldSpecs,
  type ThemeSection
} from './aiToolFieldSpecs';
import { createDiffHunks } from './diffUtils';
import { appendUniqueHistory, createHistoryEntry } from './documentHistory';
import { getTocLevelStyles, getTocTitleFont } from './documentStructure';

export const DEFAULT_SYSTEM_PROMPT = `你是 SangDocCraft 智能交付文档排版工具的 AI 助手。
你的主要职责是协助用户撰写、润色与编辑专业级 A4 交付文档、技术方案书与规格说明，并根据需求调整文档样式和配置参数。

【本系统特有语法与特殊排版注意事项】：
1. 强制分页机制：
   - 使用 \`<!-- pagebreak -->\`（独占一行）触发强制 A4 页面换页。

2. 规范表格题注：
   - 在 Markdown 表格前紧邻的上一行添加 \`<!-- caption: 题注说明文本 -->\`，系统会自动按照工程交付规范渲染表格标题序号与居中标注。

3. 图片引用与尺寸后缀：
   - 支持标准图片语法，并支持自定义宽高属性后缀，例如：\`![系统架构图](@images/xxx){w=520}\` 或 \`![界面流程](url){w=640 h=360}\`。
   - 文档内图片引用格式为 \`@images/<id>\`，永久库图片格式为 \`@library/<id>\`。

4. 流程图与架构图（Mermaid）：
   - 支持在正文中使用标准 \`\`\`mermaid 围栏代码块，可配置 \`\`\`mermaid {theme=custom|dark|neutral|forest|base w=... h=... align=left|center|right} 单图属性，系统将在 A4 页面中实时将其转换为高质量矢量拓扑图。

5. 数学公式（LaTeX）：
   - 行内公式使用单个美元符号，例如 \`$E = mc^2$\`；独立居中的公式块使用双美元符号独占若干行：
     \`$$\` 换行写公式内容，再换行写 \`$$\`。
   - 也支持 \`\\(...\\)\`、\`\\[...\\]\`、\`\\begin{equation}...\\end{equation}\` 等写法；公式会被渲染为矢量图并参与分页，导出 DOCX 时自动栅格化为图片。
   - 避免在正文中用单个美元符号表示货币金额，否则会被识别为公式。

6. 章节大纲与版式规范：
   - 顶级章节使用一级标题 \`#\`，二级使用 \`##\`，三级使用 \`###\`。
   - 正式技术交付文本应保持结构严谨、逻辑清晰、措辞专业。`;

export const SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;

export interface AiToolContext {
  markdown: string;
  getMeta: () => DocumentMeta;
  /** 读取当前真实主题（App 侧的 ref 实时值）：工具必须以它为基线，避免闭包里的旧快照覆盖用户改动 */
  getTheme: () => DocumentTheme;
  settings: DocumentSettings;
  onUpdateMeta: (update: SetStateAction<DocumentMeta>) => void;
  onUpdateTheme: (update: SetStateAction<DocumentTheme>) => void;
  onUpdateSettings: (update: SetStateAction<DocumentSettings>) => void;
  onSetHistory: React.Dispatch<React.SetStateAction<any[]>>;
  onStartDiffReview: (session: DiffReviewSession) => Promise<DiffReviewResult>;
  onCancelDiffReview: () => void;
}

export interface DiffReviewResult {
  markdown: string;
  acceptedCount: number;
  rejectedCount: number;
  cancelled: boolean;
}

interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
}

const DOCUMENT_CONFIG_TYPES = ['meta', 'cover', 'header', 'footer', 'toc', 'color', 'style', 'watermark'] as const;
type DocumentConfigType = typeof DOCUMENT_CONFIG_TYPES[number];

function readDocumentConfigTypes(value: unknown): DocumentConfigType[] {
  if (value === undefined) return [...DOCUMENT_CONFIG_TYPES];
  if (!Array.isArray(value) || value.length === 0 || value.some(type => typeof type !== 'string')) {
    throw new AiToolExecutionError('invalid_arguments', 'types 必须是包含至少一个配置类型的数组。');
  }
  if (value.includes('all')) return [...DOCUMENT_CONFIG_TYPES];
  const invalidTypes = value.filter(type => !DOCUMENT_CONFIG_TYPES.includes(type as DocumentConfigType));
  if (invalidTypes.length > 0) {
    throw new AiToolExecutionError('invalid_arguments', `不支持的配置类型：${invalidTypes.join(', ')}。`);
  }
  return [...new Set(value)] as DocumentConfigType[];
}

function getMarkdownLines(markdown: string): string[] {
  return markdown.split(/\r?\n/);
}

function getMarkdownOutline(markdown: string): MarkdownHeading[] {
  const outline: MarkdownHeading[] = [];
  let fenceMarker = '';

  getMarkdownLines(markdown).forEach((line, index) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? '' : (fenceMarker || marker);
      return;
    }
    if (fenceMarker) return;

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      outline.push({ level: heading[1].length, text: heading[2], line: index + 1 });
    }
  });

  return outline;
}

function readInteger(value: unknown, name: string, minimum: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || Number(value) < minimum) {
    throw new AiToolExecutionError('invalid_arguments', `${name} 必须是大于等于 ${minimum} 的整数。`);
  }
  return Number(value);
}

interface UpdateVerification {
  field: string;
  expected: unknown;
  actual: unknown;
}

function formatUpdateVerification(checks: UpdateVerification[]): string {
  if (checks.length === 0) return '更新成功';
  const failed = checks.filter(({ expected, actual }) => JSON.stringify(expected) !== JSON.stringify(actual));
  if (failed.length === 0) return '更新成功';
  return JSON.stringify({
    error: '更新未完成',
    fields: failed.map(({ field, expected, actual }) => ({ field, expected, actual })),
  }, null, 2);
}

type SectionRecords = Record<ThemeSection, Record<string, unknown>>;

function toSectionRecords(meta: DocumentMeta, theme: DocumentTheme): SectionRecords {
  return {
    meta: { ...meta },
    cover: { ...theme.cover },
    header: { ...theme.header },
    footer: { ...theme.footer },
    toc: { ...theme.toc },
    style: { ...theme.style },
  };
}

function fromSectionRecords(theme: DocumentTheme, sections: SectionRecords): { meta: DocumentMeta; theme: DocumentTheme } {
  return {
    meta: sections.meta as unknown as DocumentMeta,
    theme: {
      ...theme,
      cover: sections.cover as unknown as CoverConfig,
      header: sections.header as unknown as HeaderConfig,
      footer: sections.footer as unknown as FooterConfig,
      toc: sections.toc as unknown as TocConfig,
      style: sections.style as unknown as StyleConfig,
    },
  };
}

/**
 * 按规格表写入字段：只处理规格表里声明过的参数，且逐个做类型/枚举/范围校验，
 * 模型多传的未知键会被忽略，非法值会抛 invalid_arguments 让模型自行纠正。
 */
function applyScalarFields(
  sections: SectionRecords,
  args: Record<string, unknown>,
  specs: readonly ScalarFieldSpec[],
): void {
  specs.forEach(spec => {
    const raw = args[spec.argument];
    if (raw === undefined) return;
    const value = readFieldValue(spec.argument, spec, raw);
    const target = sections[spec.section];
    target[spec.field ?? spec.argument] = value;
  });
}

/** 写入后的字段级回读校验（只覆盖本次请求到的字段） */
function verifyScalarFields(
  sections: SectionRecords,
  args: Record<string, unknown>,
  specs: readonly ScalarFieldSpec[],
): UpdateVerification[] {
  const checks: UpdateVerification[] = [];
  specs.forEach(spec => {
    const raw = args[spec.argument];
    if (raw === undefined) return;
    const value = readFieldValue(spec.argument, spec, raw);
    const section = sections[spec.section];
    const field = spec.field ?? spec.argument;
    checks.push({ field: spec.argument, expected: value, actual: section[field] });
  });
  return checks;
}

/** 合并白名单子对象（如 watermark / imageConfig）：未声明的键直接丢弃，避免污染持久化的主题 */
function applySubFields(target: unknown, requested: unknown, specs: SubFieldSpecs): Record<string, unknown> {
  const base = typeof target === 'object' && target !== null ? target as Record<string, unknown> : {};
  return { ...base, ...pickSubFields(requested, specs) };
}

/** 校验白名单子对象里实际请求到的字段 */
function verifySubFields(
  checks: UpdateVerification[],
  prefix: string,
  requested: unknown,
  actual: unknown,
  specs: SubFieldSpecs,
): void {
  const picked = pickSubFields(requested, specs);
  const actualRecord = typeof actual === 'object' && actual !== null ? actual as Record<string, unknown> : {};
  Object.entries(picked).forEach(([key, value]) => {
    checks.push({ field: `${prefix}.${key}`, expected: value, actual: actualRecord[key] });
  });
}

export function buildAiTools(context: AiToolContext): AiToolRuntime[] {
  let currentMarkdown = context.markdown;
  let currentSettings = context.settings;

  const submitMarkdownEdit = async (newMarkdown: string, description: string): Promise<string> => {
    const hunks = createDiffHunks(currentMarkdown, newMarkdown);
    const changeHunks = hunks.filter(h => h.type === 'change');
    if (changeHunks.length === 0) {
      return '正文内容与原文档完全一致，无需进行变更。';
    }

    let historyNotice = '';
    if (!currentSettings.historyEnabled) {
      currentSettings = { ...currentSettings, historyEnabled: true };
      context.onUpdateSettings(settings => ({ ...settings, historyEnabled: true }));
      historyNotice = '（已自动开启版本历史记录并为原文档创建了安全存档快照）';
    }

    // 同一轮里主题可能已被前面的调用改过，快照必须记录最新主题，否则回滚会带回旧样式。
    const snapshot = await createHistoryEntry(currentMarkdown, context.getMeta(), context.getTheme(), 'manual');
    context.onSetHistory(prev => appendUniqueHistory(prev, snapshot));

    const reviewResult = await context.onStartDiffReview({
      id: `diff-${Date.now()}`,
      originalText: currentMarkdown,
      modifiedText: newMarkdown,
      description,
      hunks,
      createdAt: new Date().toISOString()
    });

    currentMarkdown = reviewResult.markdown;

    if (reviewResult.cancelled) {
      return `用户取消了本次正文审查，文档未变更。${historyNotice}`;
    }

    return `正文审查已完成。接受 ${reviewResult.acceptedCount} 处，拒绝 ${reviewResult.rejectedCount} 处。${historyNotice}`;
  };

  return [
    {
      definition: AI_TOOL_DEFINITIONS.get_document_config,
      handler: async (args) => {
        const types = readDocumentConfigTypes(args.types);
        const meta = context.getMeta();
        const theme = context.getTheme();
        const { primaryColor, accentColor, textColor, watermark, ...style } = theme.style;
        const config: Record<DocumentConfigType, unknown> = {
          meta,
          cover: theme.cover,
          header: theme.header,
          footer: theme.footer,
          toc: {
            ...theme.toc,
            titleFont: getTocTitleFont(theme.toc),
            levelStyles: getTocLevelStyles(theme.toc)
          },
          color: { primaryColor, accentColor, textColor },
          style,
          watermark: watermark ?? null
        };
        return JSON.stringify(Object.fromEntries(types.map(type => [type, config[type]])), null, 2);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.get_document_summary,
      handler: async () => JSON.stringify({
        markdownLength: currentMarkdown.length,
        totalLines: getMarkdownLines(currentMarkdown).length,
        historyEnabled: currentSettings.historyEnabled,
        outline: getMarkdownOutline(currentMarkdown),
        meta: context.getMeta()
      }, null, 2)
    },
    {
      definition: AI_TOOL_DEFINITIONS.get_markdown_content,
      handler: async (args) => {
        const lines = getMarkdownLines(currentMarkdown);
        const heading = typeof args.heading === 'string' ? args.heading.trim() : '';
        let startLine = readInteger(args.offset, 'offset', 1) ?? 1;
        let endLine = args.limit === undefined
          ? lines.length
          : startLine + readInteger(args.limit, 'limit', 1)! - 1;

        if (heading) {
          if (args.offset !== undefined || args.limit !== undefined) {
            throw new AiToolExecutionError('invalid_arguments', 'heading 与 offset/limit 不可同时使用。');
          }
          const outline = getMarkdownOutline(currentMarkdown);
          const matches = outline.filter(item => item.text === heading);
          if (matches.length !== 1) {
            throw new AiToolExecutionError(
              'invalid_arguments',
              matches.length === 0
                ? `未找到标题「${heading}」。`
                : `标题「${heading}」不唯一，候选行：${matches.map(item => item.line).join(', ')}。`
            );
          }
          const selected = matches[0];
          const nextHeading = outline.find(item => item.line > selected.line && item.level <= selected.level);
          startLine = selected.line;
          endLine = nextHeading ? nextHeading.line - 1 : lines.length;
        }

        if (startLine > lines.length) {
          throw new AiToolExecutionError('invalid_arguments', `offset 超出文档范围，文档共 ${lines.length} 行。`);
        }
        endLine = Math.min(endLine, lines.length);
        const selectedLines = lines.slice(startLine - 1, endLine);
        const content = args.includeLineNumbers === true
          ? selectedLines.map((line, index) => `${startLine + index}: ${line}`).join('\n')
          : selectedLines.join('\n');

        return JSON.stringify({ startLine, endLine, totalLines: lines.length, content }, null, 2);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.edit_markdown_content,
      handler: async (args) => {
        if (!Array.isArray(args.operations) || args.operations.length === 0) {
          throw new AiToolExecutionError('invalid_arguments', 'operations 必须是非空数组。');
        }

        if (!args.operations.every(operation => typeof operation === 'object' && operation !== null && !Array.isArray(operation))) {
          throw new AiToolExecutionError('invalid_arguments', 'operations 中的每一项都必须是对象。');
        }
        const operations = args.operations as Array<Record<string, unknown>>;
        const fullOperations = operations.filter(operation => operation.op === 'full');
        if (fullOperations.length > 0 && operations.length > 1) {
          throw new AiToolExecutionError('invalid_arguments', 'full 操作只能单独使用。');
        }

        const originalLines = getMarkdownLines(currentMarkdown);
        const replacements: Array<{ startLine: number; endLine: number; content: string }> = [];
        const appends: string[] = [];

        operations.forEach((operation, index) => {
          const operationName = `operations[${index}]`;
          if (operation.op !== 'append' && operation.op !== 'replace' && operation.op !== 'full') {
            throw new AiToolExecutionError('invalid_arguments', `${operationName}.op 必须是 append、replace 或 full。`);
          }
          if (typeof operation.content !== 'string') {
            throw new AiToolExecutionError('invalid_arguments', `${operationName}.content 必须是字符串。`);
          }
          if (operation.op === 'append') {
            appends.push(operation.content);
            return;
          }
          if (operation.op === 'full') {
            return;
          }
          if (typeof operation.range !== 'object' || operation.range === null) {
            throw new AiToolExecutionError('invalid_arguments', `${operationName} 的 replace 操作必须提供 range。`);
          }
          const range = operation.range as Record<string, unknown>;
          const startLine = readInteger(range.startLine, `${operationName}.range.startLine`, 1);
          const endLine = readInteger(range.endLine, `${operationName}.range.endLine`, 1);
          if (startLine === undefined || endLine === undefined) {
            throw new AiToolExecutionError('invalid_arguments', `${operationName}.range 必须同时提供 startLine 和 endLine。`);
          }
          if (startLine > endLine || endLine > originalLines.length) {
            throw new AiToolExecutionError(
              'invalid_arguments',
              `${operationName}.range 必须满足 startLine <= endLine <= ${originalLines.length}。`
            );
          }
          replacements.push({ startLine, endLine, content: operation.content });
        });

        const sortedReplacements = [...replacements].sort((left, right) => left.startLine - right.startLine);
        for (let index = 1; index < sortedReplacements.length; index++) {
          if (sortedReplacements[index].startLine <= sortedReplacements[index - 1].endLine) {
            throw new AiToolExecutionError('invalid_arguments', 'replace 区间不可重叠。');
          }
        }

        let newMarkdown: string;
        if (fullOperations.length === 1) {
          newMarkdown = fullOperations[0].content as string;
        } else {
          const newLines = [...originalLines];
          [...replacements]
            .sort((left, right) => right.startLine - left.startLine)
            .forEach(operation => {
              newLines.splice(
                operation.startLine - 1,
                operation.endLine - operation.startLine + 1,
                ...operation.content.split(/\r?\n/)
              );
            });
          newMarkdown = newLines.join('\n');
          for (const content of appends) {
            newMarkdown = newMarkdown
              ? `${newMarkdown}${newMarkdown.endsWith('\n') ? '' : '\n'}${content}`
              : content;
          }
        }

        const description = typeof args.description === 'string' ? args.description : `AI 建议的 ${operations.length} 项内容修改`;
        return submitMarkdownEdit(newMarkdown, description);
      },
      timeoutMs: 600_000,
      onTimeout: context.onCancelDiffReview
    },
    {
      definition: AI_TOOL_DEFINITIONS.replace_markdown_section,
      handler: async (args) => {
        if (typeof args.oldText !== 'string' || !args.oldText) {
          throw new AiToolExecutionError('invalid_arguments', 'oldText 必须是非空字符串。');
        }
        if (typeof args.newText !== 'string') {
          throw new AiToolExecutionError('invalid_arguments', 'newText 必须是字符串。');
        }

        const oldText = args.oldText;
        const newText = args.newText;
        const replaceAll = args.replaceAll === true;
        let pattern: RegExp | undefined;
        if (args.useRegex === true) {
          try {
            pattern = new RegExp(oldText, 'g');
          } catch (error) {
            throw new AiToolExecutionError(
              'invalid_arguments',
              `oldText 不是合法的正则表达式：${error instanceof Error ? error.message : String(error)}`
            );
          }
          if (new RegExp(pattern.source).test('')) {
            throw new AiToolExecutionError('invalid_arguments', 'oldText 正则不能匹配空字符串，请改用更具体的模式。');
          }
        }

        const indexes: number[] = [];
        if (pattern) {
          for (const match of currentMarkdown.matchAll(pattern)) {
            indexes.push(match.index ?? 0);
          }
        } else {
          let index = currentMarkdown.indexOf(oldText);
          while (index !== -1) {
            indexes.push(index);
            index = currentMarkdown.indexOf(oldText, index + oldText.length);
          }
        }
        if (indexes.length === 0) {
          throw new AiToolExecutionError(
            'invalid_arguments',
            pattern ? '未找到与 oldText 正则匹配的内容。' : '未找到与 oldText 完全匹配的内容。'
          );
        }
        if (indexes.length > 1 && !replaceAll) {
          const candidates = indexes.map(matchIndex => {
            const before = currentMarkdown.slice(0, matchIndex);
            const lines = before.split(/\r?\n/);
            return `第 ${lines.length} 行第 ${lines.at(-1)!.length + 1} 列`;
          });
          throw new AiToolExecutionError(
            'invalid_arguments',
            `oldText 匹配到 ${indexes.length} 处，非唯一。候选位置：${candidates.join('；')}。如需全局替换，请显式设置 replaceAll=true。`
          );
        }

        // 纯文本模式用 split/join：否则 newText 里的 $$、$& 会被 replace 当成替换语法吃掉（交付文档里的 LaTeX 公式很容易踩到）。
        const newMarkdown = pattern
          ? currentMarkdown.replace(replaceAll ? pattern : new RegExp(pattern.source), newText)
          : currentMarkdown.split(oldText).join(newText);
        const description = typeof args.description === 'string' ? args.description : 'AI 建议的精确内容替换';
        return submitMarkdownEdit(newMarkdown, description);
      },
      timeoutMs: 600_000,
      onTimeout: context.onCancelDiffReview
    },
    {
      definition: AI_TOOL_DEFINITIONS.update_document_meta,
      handler: async (args) => {
        const current = context.getTheme();
        const sections = toSectionRecords(context.getMeta(), current);
        applyScalarFields(sections, args, META_FIELDS);
        if (Array.isArray(args.coverlist)) {
          sections.cover.coverlist = args.coverlist
            .filter(item => typeof item === 'object' && item !== null && 'label' in item && 'value' in item)
            .map(item => {
              const entry = item as Record<string, unknown>;
              return { label: String(entry.label), value: String(entry.value) };
            });
        }
        const next = fromSectionRecords(current, sections);
        context.onUpdateMeta(next.meta);
        context.onUpdateTheme(next.theme);

        const checks = verifyScalarFields(sections, args, META_FIELDS);
        if (Array.isArray(args.coverlist)) {
          checks.push({ field: 'coverlist', expected: sections.cover.coverlist, actual: next.theme.cover.coverlist });
        }
        return formatUpdateVerification(checks);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.update_document_style,
      handler: async (args) => {
        const current = context.getTheme();
        const sections = toSectionRecords(context.getMeta(), current);
        applyScalarFields(sections, args, STYLE_FIELDS);

        const requestedHeadingFonts = typeof args.headingFonts === 'object' && args.headingFonts !== null
          ? args.headingFonts as Record<string, unknown>
          : undefined;
        if (requestedHeadingFonts) {
          const headingFonts = { ...sections.style.headingFonts as Record<string, Record<string, unknown>> };
          (['h1', 'h2', 'h3', 'h4'] as const).forEach(level => {
            headingFonts[level] = applySubFields(headingFonts[level], requestedHeadingFonts[level], HEADING_FONT_FIELDS);
          });
          sections.style.headingFonts = headingFonts;
        }
        if (typeof args.imageConfig === 'object' && args.imageConfig !== null) {
          sections.style.imageConfig = applySubFields(sections.style.imageConfig, args.imageConfig, IMAGE_CONFIG_FIELDS);
        }
        if (typeof args.tableCaptionConfig === 'object' && args.tableCaptionConfig !== null) {
          sections.style.tableCaptionConfig = applySubFields(sections.style.tableCaptionConfig, args.tableCaptionConfig, TABLE_CAPTION_FIELDS);
        }
        if (typeof args.watermark === 'object' && args.watermark !== null) {
          sections.style.watermark = applySubFields(sections.style.watermark, args.watermark, WATERMARK_FIELDS);
        }

        const { theme: nextTheme } = fromSectionRecords(current, sections);
        context.onUpdateTheme(nextTheme);

        const checks = verifyScalarFields(sections, args, STYLE_FIELDS);
        if (requestedHeadingFonts) {
          (['h1', 'h2', 'h3', 'h4'] as const).forEach(level => {
            verifySubFields(checks, `headingFonts.${level}`, requestedHeadingFonts[level], nextTheme.style.headingFonts[level], HEADING_FONT_FIELDS);
          });
        }
        verifySubFields(checks, 'imageConfig', args.imageConfig, nextTheme.style.imageConfig, IMAGE_CONFIG_FIELDS);
        verifySubFields(checks, 'tableCaptionConfig', args.tableCaptionConfig, nextTheme.style.tableCaptionConfig, TABLE_CAPTION_FIELDS);
        verifySubFields(checks, 'watermark', args.watermark, nextTheme.style.watermark, WATERMARK_FIELDS);
        return formatUpdateVerification(checks);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.update_header_footer_config,
      handler: async (args) => {
        const current = context.getTheme();
        const sections = toSectionRecords(context.getMeta(), current);
        applyScalarFields(sections, args, HEADER_FIELDS);
        applyScalarFields(sections, args, FOOTER_FIELDS);
        const { theme: nextTheme } = fromSectionRecords(current, sections);
        context.onUpdateTheme(nextTheme);

        const checks = [
          ...verifyScalarFields(sections, args, HEADER_FIELDS),
          ...verifyScalarFields(sections, args, FOOTER_FIELDS),
        ];
        return formatUpdateVerification(checks);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.update_toc_config,
      handler: async (args) => {
        const current = context.getTheme();
        const sections = toSectionRecords(context.getMeta(), current);
        applyScalarFields(sections, args, TOC_FIELDS);

        if (typeof args.titleFont === 'object' && args.titleFont !== null) {
          sections.toc.titleFont = applySubFields(getTocTitleFont(current.toc), args.titleFont, HEADING_FONT_FIELDS);
        }
        if (Array.isArray(args.levelStyles)) {
          const levelStyles = getTocLevelStyles(current.toc);
          args.levelStyles.forEach((update, index) => {
            if (index >= levelStyles.length) return;
            levelStyles[index] = { ...levelStyles[index], ...pickSubFields(update, TOC_LEVEL_FONT_FIELDS) } as TocLevelStyle;
          });
          sections.toc.levelStyles = levelStyles;
        }

        const { theme: nextTheme } = fromSectionRecords(current, sections);
        context.onUpdateTheme(nextTheme);

        const checks = verifyScalarFields(sections, args, TOC_FIELDS);
        const nextLevelStyles = getTocLevelStyles(nextTheme.toc);
        if (typeof args.titleFont === 'object' && args.titleFont !== null) {
          verifySubFields(checks, 'titleFont', args.titleFont, getTocTitleFont(nextTheme.toc), HEADING_FONT_FIELDS);
        }
        if (Array.isArray(args.levelStyles)) {
          args.levelStyles.forEach((update, index) => {
            if (index >= nextLevelStyles.length) return;
            verifySubFields(checks, `levelStyles[${index}]`, update, nextLevelStyles[index], TOC_LEVEL_FONT_FIELDS);
          });
        }
        return formatUpdateVerification(checks);
      }
    }
  ];
}
