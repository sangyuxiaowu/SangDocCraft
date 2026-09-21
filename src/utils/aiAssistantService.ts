import { 
  DocumentSettings, 
  DocumentTheme,
  TocLevelStyle,
  TocTitleFont
} from '../types';
import { 
  AiToolRuntime, 
  AiToolExecutionError,
  DiffReviewSession 
} from '../types/ai';
import type { SetStateAction } from 'react';
import { AI_TOOL_DEFINITIONS } from './aiToolDefinitions';
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
   - 支持在正文中使用标准 \`\`\`mermaid 围栏代码块，系统将在 A4 页面中实时将其转换为高质量矢量拓扑图。

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
  /** 读取当前真实主题（App 侧的 ref 实时值）：工具必须以它为基线，避免闭包里的旧快照覆盖用户改动 */
  getTheme: () => DocumentTheme;
  settings: DocumentSettings;
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

function addUpdateVerification(
  checks: UpdateVerification[],
  field: string,
  expected: unknown,
  actual: unknown,
): void {
  if (
    typeof expected === 'object' && expected !== null && !Array.isArray(expected)
    && typeof actual === 'object' && actual !== null && !Array.isArray(actual)
  ) {
    Object.entries(expected).forEach(([key, value]) => {
      addUpdateVerification(checks, `${field}.${key}`, value, (actual as Record<string, unknown>)[key]);
    });
    return;
  }
  checks.push({ field, expected, actual });
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

/** 仅提取目录字体/层级样式的已知字段，避免上游多余键污染主题配置 */
function pickTocFontFields(value: unknown): Partial<TocLevelStyle> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const picked: Partial<TocLevelStyle> = {};
  if (typeof source.fontFamily === 'string') picked.fontFamily = source.fontFamily;
  if (typeof source.fontSize === 'number') picked.fontSize = source.fontSize;
  if (typeof source.bold === 'boolean') picked.bold = source.bold;
  if (typeof source.italic === 'boolean') picked.italic = source.italic;
  if (typeof source.underline === 'boolean') picked.underline = source.underline;
  if (typeof source.marginBefore === 'number') picked.marginBefore = source.marginBefore;
  if (typeof source.marginAfter === 'number') picked.marginAfter = source.marginAfter;
  if (typeof source.paddingLeft === 'number') picked.paddingLeft = source.paddingLeft;
  return picked;
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
    const snapshot = await createHistoryEntry(currentMarkdown, context.getTheme(), 'manual');
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
      definition: AI_TOOL_DEFINITIONS.get_document_state,
      handler: async () => {
        // 按配置分区返回，避免扁平字段与完整对象重复；meta 拆出 cover 是为了对齐封面展示项。
        const theme = context.getTheme();
        const { title, subtitle, author, department, organization, date, version, number, ...cover } = theme.meta;
        const { primaryColor, accentColor, textColor, backgroundColor, coverBgColor, watermark, ...style } = theme.style;
        return JSON.stringify({
          markdownLength: currentMarkdown.length,
          totalLines: getMarkdownLines(currentMarkdown).length,
          historyEnabled: currentSettings.historyEnabled,
          outline: getMarkdownOutline(currentMarkdown),
          meta: { title, subtitle, author, department, organization, date, version, number },
          cover,
          header: theme.header,
          footer: theme.footer,
          toc: {
            ...theme.toc,
            titleFont: getTocTitleFont(theme.toc),
            levelStyles: getTocLevelStyles(theme.toc)
          },
          color: { primaryColor, accentColor, textColor, backgroundColor, coverBgColor },
          style,
          watermark: watermark ?? null
        }, null, 2);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.get_document_summary,
      handler: async () => JSON.stringify({
        markdownLength: currentMarkdown.length,
        totalLines: getMarkdownLines(currentMarkdown).length,
        historyEnabled: currentSettings.historyEnabled,
        outline: getMarkdownOutline(currentMarkdown)
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
        const applyUpdate = (theme: DocumentTheme): DocumentTheme => {
          const updatedMeta = { ...theme.meta };
          if (args.title !== undefined) updatedMeta.title = String(args.title);
          if (args.subtitle !== undefined) updatedMeta.subtitle = String(args.subtitle);
          if (args.author !== undefined) updatedMeta.author = String(args.author);
          if (args.department !== undefined) updatedMeta.department = String(args.department);
          if (args.organization !== undefined) updatedMeta.organization = String(args.organization);
          if (args.date !== undefined) updatedMeta.date = String(args.date);
          if (args.version !== undefined) updatedMeta.version = String(args.version);
          if (args.number !== undefined) updatedMeta.number = String(args.number);
          if (args.showCover !== undefined) updatedMeta.showCover = Boolean(args.showCover);
          if (args.coverStyle !== undefined) updatedMeta.coverStyle = String(args.coverStyle);
          if (args.logoUrl !== undefined) {
            updatedMeta.logo = String(args.logoUrl);
            updatedMeta.logoUrl = String(args.logoUrl);
          }
          if (typeof args.logoHeight === 'number') updatedMeta.logoHeight = args.logoHeight;
          if (args.coverListColumns === 1 || args.coverListColumns === 2) updatedMeta.coverListColumns = args.coverListColumns;
          if (Array.isArray(args.coverlist)) {
            updatedMeta.coverlist = args.coverlist
              .filter(item => typeof item === 'object' && item !== null && 'label' in item && 'value' in item)
              .map(item => ({ label: String(item.label), value: String(item.value) }));
          }
          return { ...theme, meta: updatedMeta };
        };

        const nextTheme = applyUpdate(context.getTheme());
        context.onUpdateTheme(nextTheme);
        const updatedMeta = nextTheme.meta;

        const checks: UpdateVerification[] = [];
        const fieldMap: Record<string, keyof typeof updatedMeta> = {
          title: 'title', subtitle: 'subtitle', author: 'author', department: 'department', organization: 'organization',
          date: 'date', version: 'version', number: 'number', showCover: 'showCover', coverStyle: 'coverStyle',
          logoUrl: 'logoUrl', logoHeight: 'logoHeight', coverListColumns: 'coverListColumns', coverlist: 'coverlist',
        };
        Object.entries(fieldMap).forEach(([argument, metaField]) => {
          if (args[argument] !== undefined) addUpdateVerification(checks, argument, args[argument], updatedMeta[metaField]);
        });
        return formatUpdateVerification(checks);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.update_document_style,
      handler: async (args) => {
        const applyUpdate = (theme: DocumentTheme): DocumentTheme => {
          const updatedStyle = { ...theme.style };
          if (args.primaryColor !== undefined) updatedStyle.primaryColor = String(args.primaryColor);
          if (args.accentColor !== undefined) updatedStyle.accentColor = String(args.accentColor);
          if (args.textColor !== undefined) updatedStyle.textColor = String(args.textColor);
          if (typeof args.fontSize === 'number') updatedStyle.fontSize = args.fontSize;
          if (typeof args.lineHeight === 'number') updatedStyle.lineHeight = args.lineHeight;
          if (args.backgroundColor !== undefined) updatedStyle.backgroundColor = String(args.backgroundColor);
          if (args.coverBgColor !== undefined) updatedStyle.coverBgColor = String(args.coverBgColor);
          if (args.fontFamily) updatedStyle.fontFamily = args.fontFamily as any;
          if (args.latinFontFamily !== undefined) updatedStyle.latinFontFamily = String(args.latinFontFamily);
          if (args.bodyFontFamily !== undefined) updatedStyle.bodyFontFamily = String(args.bodyFontFamily);
          if (args.h1Style) updatedStyle.h1Style = args.h1Style as any;
          if (args.h2Style) updatedStyle.h2Style = args.h2Style as any;
          if (args.h3Style) updatedStyle.h3Style = args.h3Style as any;
          if (args.indentParagraph !== undefined) updatedStyle.indentParagraph = Boolean(args.indentParagraph);
          if (args.h1PageBreak !== undefined) updatedStyle.h1PageBreak = Boolean(args.h1PageBreak);
          if (args.h1Center !== undefined) updatedStyle.h1Center = Boolean(args.h1Center);
          if (args.paginationMode) updatedStyle.paginationMode = args.paginationMode as any;
          if (args.bulletStyle) updatedStyle.bulletStyle = args.bulletStyle as any;
          if (args.numberStyle) updatedStyle.numberStyle = args.numberStyle as any;
          if (args.codeTheme) updatedStyle.codeTheme = args.codeTheme as any;
          if (args.tableStyle) updatedStyle.tableStyle = args.tableStyle as any;
          if (typeof args.headingFonts === 'object' && args.headingFonts !== null) {
            const headingFonts = args.headingFonts as Record<string, unknown>;
            (['h1', 'h2', 'h3', 'h4'] as const).forEach(level => {
              const update = headingFonts[level];
              if (typeof update === 'object' && update !== null) {
                updatedStyle.headingFonts = {
                  ...updatedStyle.headingFonts,
                  [level]: { ...updatedStyle.headingFonts[level], ...update }
                };
              }
            });
          }
          if (typeof args.imageConfig === 'object' && args.imageConfig !== null) {
            updatedStyle.imageConfig = { ...updatedStyle.imageConfig, ...args.imageConfig } as NonNullable<DocumentTheme['style']['imageConfig']>;
          }
          if (typeof args.tableCaptionConfig === 'object' && args.tableCaptionConfig !== null) {
            updatedStyle.tableCaptionConfig = { ...updatedStyle.tableCaptionConfig, ...args.tableCaptionConfig } as NonNullable<DocumentTheme['style']['tableCaptionConfig']>;
          }
          if (typeof args.watermark === 'object' && args.watermark !== null) {
            updatedStyle.watermark = { ...updatedStyle.watermark, ...args.watermark } as NonNullable<DocumentTheme['style']['watermark']>;
          }
          return { ...theme, style: updatedStyle };
        };

        const nextTheme = applyUpdate(context.getTheme());
        context.onUpdateTheme(nextTheme);
        const updatedStyle = nextTheme.style;
        const checks: UpdateVerification[] = [];
        const scalarFields: Array<[string, keyof DocumentTheme['style']]> = [
          ['primaryColor', 'primaryColor'], ['accentColor', 'accentColor'], ['textColor', 'textColor'],
          ['fontSize', 'fontSize'], ['lineHeight', 'lineHeight'], ['backgroundColor', 'backgroundColor'],
          ['coverBgColor', 'coverBgColor'], ['fontFamily', 'fontFamily'], ['latinFontFamily', 'latinFontFamily'],
          ['bodyFontFamily', 'bodyFontFamily'], ['h1Style', 'h1Style'], ['h2Style', 'h2Style'], ['h3Style', 'h3Style'],
          ['indentParagraph', 'indentParagraph'], ['h1PageBreak', 'h1PageBreak'], ['h1Center', 'h1Center'],
          ['paginationMode', 'paginationMode'], ['bulletStyle', 'bulletStyle'], ['numberStyle', 'numberStyle'],
          ['codeTheme', 'codeTheme'], ['tableStyle', 'tableStyle'],
        ];
        scalarFields.forEach(([argument, styleField]) => {
          if (args[argument] !== undefined) checks.push({ field: argument, expected: args[argument], actual: updatedStyle[styleField] });
        });
        (['headingFonts', 'imageConfig', 'tableCaptionConfig', 'watermark'] as const).forEach(section => {
          const requested = args[section];
          const actual = updatedStyle[section];
          if (typeof requested !== 'object' || requested === null || Array.isArray(requested)) return;
          addUpdateVerification(checks, section, requested, actual);
        });

        return formatUpdateVerification(checks);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.update_header_footer_config,
      handler: async (args) => {
        const applyUpdate = (theme: DocumentTheme): DocumentTheme => {
          const nextHeader = { ...theme.header };
          const nextFooter = { ...theme.footer };
          if (args.headerShow !== undefined) nextHeader.show = Boolean(args.headerShow);
          if (args.headerLeftText !== undefined) nextHeader.leftText = String(args.headerLeftText);
          if (args.headerCenterText !== undefined) nextHeader.centerText = String(args.headerCenterText);
          if (args.headerRightText !== undefined) nextHeader.rightText = String(args.headerRightText);
          if (args.headerLineStyle) nextHeader.lineStyle = args.headerLineStyle as any;
          if (args.headerHideOnCover !== undefined) nextHeader.hideOnCover = Boolean(args.headerHideOnCover);
          if (args.headerLogoUrl !== undefined) nextHeader.logoUrl = String(args.headerLogoUrl);
          if (typeof args.headerLogoHeight === 'number') nextHeader.logoHeight = args.headerLogoHeight;
          if (typeof args.headerLogoOpacity === 'number') nextHeader.logoOpacity = args.headerLogoOpacity;
          if (typeof args.headerLeftTextOffset === 'number') nextHeader.leftTextOffset = args.headerLeftTextOffset;
          if (typeof args.headerLogoTopOffset === 'number') nextHeader.logoTopOffset = args.headerLogoTopOffset;
          if (args.footerShow !== undefined) nextFooter.show = Boolean(args.footerShow);
          if (args.footerLeftText !== undefined) nextFooter.leftText = String(args.footerLeftText);
          if (args.footerCenterText !== undefined) nextFooter.centerText = String(args.footerCenterText);
          if (args.footerRightText !== undefined) nextFooter.rightText = String(args.footerRightText);
          if (args.footerHideOnCover !== undefined) nextFooter.hideOnCover = Boolean(args.footerHideOnCover);
          if (args.pageNumberFormat) nextFooter.pageNumberFormat = args.pageNumberFormat as any;
          if (args.pageNumberPosition) nextFooter.pageNumberPosition = args.pageNumberPosition as any;
          return { ...theme, header: nextHeader, footer: nextFooter };
        };

        const nextTheme = applyUpdate(context.getTheme());
        context.onUpdateTheme(nextTheme);
        const { header: nextHeader, footer: nextFooter } = nextTheme;

        const checks: UpdateVerification[] = [];
        const fields: Array<[string, 'header' | 'footer', string]> = [
          ['headerShow', 'header', 'show'], ['headerLeftText', 'header', 'leftText'], ['headerCenterText', 'header', 'centerText'],
          ['headerRightText', 'header', 'rightText'], ['headerLineStyle', 'header', 'lineStyle'], ['headerHideOnCover', 'header', 'hideOnCover'],
          ['headerLogoUrl', 'header', 'logoUrl'], ['headerLogoHeight', 'header', 'logoHeight'], ['headerLogoOpacity', 'header', 'logoOpacity'],
          ['headerLeftTextOffset', 'header', 'leftTextOffset'], ['headerLogoTopOffset', 'header', 'logoTopOffset'],
          ['footerShow', 'footer', 'show'], ['footerLeftText', 'footer', 'leftText'], ['footerCenterText', 'footer', 'centerText'],
          ['footerRightText', 'footer', 'rightText'], ['footerHideOnCover', 'footer', 'hideOnCover'],
          ['pageNumberFormat', 'footer', 'pageNumberFormat'], ['pageNumberPosition', 'footer', 'pageNumberPosition'],
        ];
        fields.forEach(([argument, section, field]) => {
          if (args[argument] !== undefined) {
            const source = section === 'header' ? nextHeader : nextFooter;
            checks.push({ field: argument, expected: args[argument], actual: (source as unknown as Record<string, unknown>)[field] });
          }
        });
        return formatUpdateVerification(checks);
      }
    },
    {
      definition: AI_TOOL_DEFINITIONS.update_toc_config,
      handler: async (args) => {
        const applyUpdate = (theme: DocumentTheme): DocumentTheme => {
          const nextToc = { ...theme.toc };
          if (args.show !== undefined) nextToc.show = Boolean(args.show);
          if (args.title !== undefined) nextToc.title = String(args.title);
          if (args.titleCenter !== undefined) nextToc.titleCenter = Boolean(args.titleCenter);
          if (args.titleStyle) nextToc.titleStyle = args.titleStyle as any;
          if (typeof args.titleFont === 'object' && args.titleFont !== null) {
            nextToc.titleFont = {
              ...getTocTitleFont(theme.toc),
              ...pickTocFontFields(args.titleFont)
            } as TocTitleFont;
          }
          if (Array.isArray(args.levelStyles)) {
            const levelStyles = getTocLevelStyles(theme.toc);
            args.levelStyles.forEach((update: unknown, index: number) => {
              if (index >= levelStyles.length) return;
              const fields = pickTocFontFields(update);
              if (Object.keys(fields).length > 0) {
                levelStyles[index] = { ...levelStyles[index], ...fields };
              }
            });
            nextToc.levelStyles = levelStyles;
          }
          if (typeof args.maxDepth === 'number') nextToc.maxDepth = args.maxDepth as any;
          if (args.headingNumbering) nextToc.headingNumbering = args.headingNumbering as any;
          if (args.leaderStyle) nextToc.leaderStyle = args.leaderStyle as any;
          if (args.showPageNumbers !== undefined) nextToc.showPageNumbers = Boolean(args.showPageNumbers);
          if (args.pageBreakAfter !== undefined) nextToc.pageBreakAfter = Boolean(args.pageBreakAfter);
          if (args.titleOnEveryPage !== undefined) nextToc.titleOnEveryPage = Boolean(args.titleOnEveryPage);
          return { ...theme, toc: nextToc };
        };

        const nextTheme = applyUpdate(context.getTheme());
        context.onUpdateTheme(nextTheme);
        const nextToc = nextTheme.toc;
        const checks: UpdateVerification[] = [];
        const scalarFields: Array<[string, unknown]> = [
          ['show', nextToc.show], ['title', nextToc.title], ['titleCenter', nextToc.titleCenter],
          ['titleStyle', nextToc.titleStyle], ['maxDepth', nextToc.maxDepth],
          ['headingNumbering', nextToc.headingNumbering], ['leaderStyle', nextToc.leaderStyle],
          ['showPageNumbers', nextToc.showPageNumbers], ['pageBreakAfter', nextToc.pageBreakAfter],
          ['titleOnEveryPage', nextToc.titleOnEveryPage],
        ];
        scalarFields.forEach(([argument, actual]) => {
          if (args[argument] !== undefined) checks.push({ field: argument, expected: args[argument], actual });
        });
        if (typeof args.titleFont === 'object' && args.titleFont !== null) {
          addUpdateVerification(checks, 'titleFont', pickTocFontFields(args.titleFont), getTocTitleFont(nextToc));
        }
        if (Array.isArray(args.levelStyles)) {
          const levelStyles = getTocLevelStyles(nextToc);
          args.levelStyles.forEach((update, index) => {
            const fields = pickTocFontFields(update);
            if (index >= levelStyles.length || Object.keys(fields).length === 0) return;
            addUpdateVerification(checks, `levelStyles[${index}]`, fields, levelStyles[index]);
          });
        }
        return formatUpdateVerification(checks);
      }
    }
  ];
}
