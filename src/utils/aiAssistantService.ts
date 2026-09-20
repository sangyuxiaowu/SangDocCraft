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
  theme: DocumentTheme;
  settings: DocumentSettings;
  onUpdateMarkdown: (newMarkdown: string) => void;
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
  let currentTheme = context.theme;
  let currentSettings = context.settings;

  const submitMarkdownEdit = async (newMarkdown: string, description: string): Promise<string> => {
    let historyNotice = '';
    if (!currentSettings.historyEnabled) {
      currentSettings = { ...currentSettings, historyEnabled: true };
      context.onUpdateSettings(settings => ({ ...settings, historyEnabled: true }));
      historyNotice = '（已自动开启版本历史记录并为原文档创建了安全存档快照）';
    }

    const snapshot = await createHistoryEntry(currentMarkdown, context.theme, 'manual');
    context.onSetHistory(prev => appendUniqueHistory(prev, snapshot));

    const hunks = createDiffHunks(currentMarkdown, newMarkdown);
    const changeHunks = hunks.filter(h => h.type === 'change');
    if (changeHunks.length === 0) {
      return `正文内容与原文档完全一致，无需进行变更。${historyNotice}`;
    }

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
      definition: {
        type: 'function',
        function: {
          name: 'get_document_state',
          description: '获取当前交付文档的配置状态、Markdown 长度、总行数和章节骨架。',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      handler: async () => {
        return JSON.stringify({
          title: currentTheme.meta.title,
          subtitle: currentTheme.meta.subtitle,
          author: currentTheme.meta.author,
          organization: currentTheme.meta.organization,
          version: currentTheme.meta.version,
          date: currentTheme.meta.date,
          coverStyle: currentTheme.meta.coverStyle,
          showCover: currentTheme.meta.showCover,
          primaryColor: currentTheme.style.primaryColor,
          accentColor: currentTheme.style.accentColor,
          fontFamily: currentTheme.style.fontFamily,
          fontSize: currentTheme.style.fontSize,
          h1Style: currentTheme.style.h1Style,
          indentParagraph: currentTheme.style.indentParagraph,
          h1PageBreak: currentTheme.style.h1PageBreak,
          header: currentTheme.header,
          footer: currentTheme.footer,
          toc: {
            ...currentTheme.toc,
            titleFont: getTocTitleFont(currentTheme.toc),
            levelStyles: getTocLevelStyles(currentTheme.toc)
          },
          meta: currentTheme.meta,
          style: currentTheme.style,
          historyEnabled: currentSettings.historyEnabled,
          markdownLength: currentMarkdown.length,
          totalLines: getMarkdownLines(currentMarkdown).length,
          outline: getMarkdownOutline(currentMarkdown)
        }, null, 2);
      }
    },
    {
      definition: {
        type: 'function',
        function: {
          name: 'get_document_summary',
          description: '获取当前 Markdown 的长度、总行数和章节大纲，用于在正文修改完成后快速确认最新文档结构。',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      handler: async () => JSON.stringify({
        markdownLength: currentMarkdown.length,
        totalLines: getMarkdownLines(currentMarkdown).length,
        outline: getMarkdownOutline(currentMarkdown)
      }, null, 2)
    },
    {
      definition: {
        type: 'function',
        function: {
          name: 'get_markdown_content',
          description: '获取 Markdown 正文。可读取全文、指定 1-based 行区间，或按标题读取完整章节。heading 与 offset/limit 不可同时使用。',
          parameters: {
            type: 'object',
            properties: {
              offset: { type: 'integer', minimum: 1, description: '起始行，1-based，默认 1。' },
              limit: { type: 'integer', minimum: 1, description: '读取行数，缺省时读到末尾。' },
              heading: { type: 'string', description: '标题文本，读取该标题及其下属内容，直到下一个同级或更高级标题。' },
              includeLineNumbers: { type: 'boolean', description: '是否在每行内容前添加物理行号。' }
            }
          }
        }
      },
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
          const matches = getMarkdownOutline(currentMarkdown).filter(item => item.text === heading);
          if (matches.length !== 1) {
            throw new AiToolExecutionError(
              'invalid_arguments',
              matches.length === 0
                ? `未找到标题「${heading}」。`
                : `标题「${heading}」不唯一，候选行：${matches.map(item => item.line).join(', ')}。`
            );
          }
          const selected = matches[0];
          const nextHeading = getMarkdownOutline(currentMarkdown)
            .find(item => item.line > selected.line && item.level <= selected.level);
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
      definition: {
        type: 'function',
        function: {
          name: 'edit_markdown_content',
          description: '原子批量编辑 Markdown 正文，一次调用只触发一次审查。所有 replace 区间都基于批次开始时的原文行号且不可重叠；append 在 replace 完成后按 operations 顺序追加；full 只能单独使用。同一批 toolCalls 仅允许调用一次本工具。',
          parameters: {
            type: 'object',
            properties: {
              operations: {
                type: 'array',
                minItems: 1,
                description: '要原子执行的编辑操作。replace 区间均以批次开始前的原文为基准。',
                items: {
                  type: 'object',
                  properties: {
                    op: {
                      type: 'string',
                      enum: ['append', 'replace', 'full'],
                      description: '编辑操作。'
                    },
                    content: {
                      type: 'string',
                      description: '要追加、替换或作为全文写入的 Markdown 内容。'
                    },
                    range: {
                      type: 'object',
                      description: 'replace 操作必填的 1-based 闭区间。',
                      properties: {
                        startLine: { type: 'integer', minimum: 1 },
                        endLine: { type: 'integer', minimum: 1 }
                      },
                      required: ['startLine', 'endLine']
                    }
                  },
                  required: ['op', 'content']
                }
              },
              description: {
                type: 'string',
                description: '本次正文修改的简要描述，例如“润色第一章并补充技术指标表格题注”。'
              }
            },
            required: ['operations']
          }
        }
      },
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
      definition: {
        type: 'function',
        function: {
          name: 'replace_markdown_section',
          description: '精确替换 Markdown 中的字符串。默认要求 oldText 唯一；需要全局替换时必须显式设置 replaceAll=true。',
          parameters: {
            type: 'object',
            properties: {
              oldText: { type: 'string', minLength: 1, description: '要精确匹配的原始文本。' },
              newText: { type: 'string', description: '替换后的文本。' },
              replaceAll: { type: 'boolean', description: '显式声明替换所有匹配项，默认 false。' },
              description: { type: 'string', description: '本次修改的简要描述。' }
            },
            required: ['oldText', 'newText']
          }
        }
      },
      handler: async (args) => {
        if (typeof args.oldText !== 'string' || !args.oldText) {
          throw new AiToolExecutionError('invalid_arguments', 'oldText 必须是非空字符串。');
        }
        if (typeof args.newText !== 'string') {
          throw new AiToolExecutionError('invalid_arguments', 'newText 必须是字符串。');
        }

        const indexes: number[] = [];
        let index = currentMarkdown.indexOf(args.oldText);
        while (index !== -1) {
          indexes.push(index);
          index = currentMarkdown.indexOf(args.oldText, index + args.oldText.length);
        }
        if (indexes.length === 0) {
          throw new AiToolExecutionError('invalid_arguments', '未找到与 oldText 完全匹配的内容。');
        }
        if (indexes.length > 1 && args.replaceAll !== true) {
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

        const newMarkdown = args.replaceAll === true
          ? currentMarkdown.split(args.oldText).join(args.newText)
          : currentMarkdown.replace(args.oldText, args.newText);
        const description = typeof args.description === 'string' ? args.description : 'AI 建议的精确内容替换';
        return submitMarkdownEdit(newMarkdown, description);
      },
      timeoutMs: 600_000,
      onTimeout: context.onCancelDiffReview
    },
    {
      definition: {
        type: 'function',
        function: {
          name: 'update_document_meta',
          description: '调整文档的封面元信息，如文档标题、副标题、作者、部门、机构、日期、版本号、编号、是否显示封面等。',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '主标题' },
              subtitle: { type: 'string', description: '副标题' },
              author: { type: 'string', description: '作者姓名' },
              department: { type: 'string', description: '所属部门' },
              organization: { type: 'string', description: '机构/公司名称' },
              date: { type: 'string', description: '日期 (如 2025-05-20)' },
              version: { type: 'string', description: '版本号 (如 v1.0.0)' },
              number: { type: 'string', description: '文档编号 (如 DOC-2025-001)' },
              showCover: { type: 'boolean', description: '是否展示独立封面页' },
              coverStyle: { type: 'string', description: '封面样式风格，值应来自当前可用封面模板 ID' },
              logoUrl: { type: 'string', description: '封面 Logo 的图片 URL 或 @images/@library 引用，空字符串表示清除' },
              logoHeight: { type: 'number', description: '封面 Logo 高度，单位 px，范围 20-120' },
              coverListColumns: { type: 'number', enum: [1, 2], description: '封面属性列表列数' },
              coverlist: {
                type: 'array',
                description: '封面自定义属性字段列表，文档信息元数据，会展示在封面上',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: '字段名称' },
                    value: { type: 'string', description: '字段内容' }
                  },
                  required: ['label', 'value']
                }
              }
            }
          }
        }
      },
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

        currentTheme = applyUpdate(currentTheme);
        context.onUpdateTheme(applyUpdate);
        const updatedMeta = currentTheme.meta;

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
      definition: {
        type: 'function',
        function: {
          name: 'update_document_style',
          description: '调整排版设计与视觉风格参数，如主色、强调色、文字字号、行高、正文字体、一级标题样式、首行缩进、一级标题独立换页等。',
          parameters: {
            type: 'object',
            properties: {
              primaryColor: { type: 'string', description: '主色调 hex (如 #1e293b, #0369a1)' },
              accentColor: { type: 'string', description: '强调色 hex (如 #2563eb, #0ea5e9)' },
              textColor: { type: 'string', description: '正文文字颜色 hex (如 #0f172a, #334155)' },
              fontSize: { type: 'number', description: '正文基础字号，单位 px (如 13, 14, 15)' },
              lineHeight: { type: 'number', description: '行高比例 (如 1.6, 1.8)' },
              paragraphMarginBefore: { type: 'number', description: '正文段前间距，单位 px，默认 0' },
              paragraphMarginAfter: { type: 'number', description: '正文段后间距，单位 px，默认 6' },
              backgroundColor: { type: 'string', description: '正文页面背景色 hex' },
              coverBgColor: { type: 'string', description: '封面背景色 hex' },
              fontFamily: { 
                type: 'string', 
                enum: ['sans', 'serif', 'kaiti', 'heiti', 'mono'],
                description: '正文字体类型' 
              },
              h1Style: {
                type: 'string',
                enum: ['underline', 'accent-block', 'badge', 'minimal'],
                description: '一级标题外观风格'
              },
              h2Style: {
                type: 'string',
                enum: ['border-left', 'number-prefix', 'underline-subtle', 'plain'],
                description: '二级标题外观风格'
              },
              h3Style: {
                type: 'string',
                enum: ['bullet', 'bold', 'plain'],
                description: '三级标题外观风格'
              },
              latinFontFamily: { type: 'string', description: '英文与数字字体名称，如 Times New Roman' },
              bodyFontFamily: { type: 'string', description: '正文字体 CSS font-family，inherit 表示跟随文档字体' },
              indentParagraph: { type: 'boolean', description: '正文首行缩进 2 字符' },
              h1PageBreak: { type: 'boolean', description: '一级标题自动另起一页' },
              h1Center: { type: 'boolean', description: '一级标题居中' },
              paginationMode: { type: 'string', enum: ['auto', 'manual'], description: '自动分页或仅按 pagebreak 手动分页' },
              bulletStyle: { type: 'string', enum: ['dot', 'square', 'checkmark', 'arrow'], description: '无序列表图标样式' },
              numberStyle: { type: 'string', enum: ['decimal', 'paren', 'chinese'], description: '有序列表编号样式' },
              codeTheme: { type: 'string', enum: ['dark', 'light', 'github'], description: '代码块主题' },
              tableStyle: { type: 'string', enum: ['striped', 'bordered', 'minimal'], description: '表格样式' },
              headingFonts: {
                type: 'object',
                description: 'H1-H4 标题详细字体设置，可仅提供需要修改的级别和字段',
                properties: Object.fromEntries(['h1', 'h2', 'h3', 'h4'].map(level => [level, {
                  type: 'object',
                  properties: {
                    fontFamily: { type: 'string' },
                    fontSize: { type: 'number' },
                    bold: { type: 'boolean' },
                    italic: { type: 'boolean' },
                    underline: { type: 'boolean' },
                    marginBefore: { type: 'number' },
                    marginAfter: { type: 'number' }
                  }
                }]))
              },
              imageConfig: {
                type: 'object',
                description: '图片边框和题注配置',
                properties: {
                  borderStyle: { type: 'string', enum: ['none', 'solid', 'subtle', 'shadow', 'card', 'rounded'] },
                  borderColor: { type: 'string' },
                  showCaption: { type: 'boolean' },
                  autoNumber: { type: 'boolean' },
                  numberPrefix: { type: 'string' },
                  captionAlign: { type: 'string', enum: ['center', 'left', 'right'] }
                }
              },
              tableCaptionConfig: {
                type: 'object',
                description: '表格题注配置',
                properties: {
                  showCaption: { type: 'boolean' },
                  autoNumber: { type: 'boolean' },
                  numberPrefix: { type: 'string' },
                  captionPosition: { type: 'string', enum: ['top', 'bottom'] },
                  captionAlign: { type: 'string', enum: ['center', 'left', 'right'] }
                }
              },
              watermark: {
                type: 'object',
                description: '文档水印配置',
                properties: {
                  show: { type: 'boolean' },
                  type: { type: 'string', enum: ['text', 'image'] },
                  text: { type: 'string' },
                  fontSize: { type: 'number' },
                  color: { type: 'string' },
                  opacity: { type: 'number' },
                  rotate: { type: 'number' },
                  layout: { type: 'string', enum: ['single', 'repeat'] },
                  repeatGap: { type: 'number' },
                  hideOnCover: { type: 'boolean' },
                  imageUrl: { type: 'string' },
                  imageWidth: { type: 'number' }
                }
              }
            }
          }
        }
      },
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

        currentTheme = applyUpdate(currentTheme);
        context.onUpdateTheme(applyUpdate);
        const updatedStyle = currentTheme.style;
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
      definition: {
        type: 'function',
        function: {
          name: 'update_header_footer_config',
          description: '配置 A4 页面的页眉与页脚内容及格式（如左右文本、页码格式、分割线样式等）。',
          parameters: {
            type: 'object',
            properties: {
              headerShow: { type: 'boolean', description: '是否展示页眉' },
              headerLeftText: { type: 'string', description: '页眉左侧文本' },
              headerCenterText: { type: 'string', description: '页眉居中文本' },
              headerRightText: { type: 'string', description: '页眉右侧文本' },
              headerLineStyle: { type: 'string', enum: ['solid', 'accent', 'double', 'none'], description: '页眉分隔线样式' },
              headerHideOnCover: { type: 'boolean', description: '封面是否隐藏页眉' },
              headerLogoUrl: { type: 'string', description: '页眉 Logo 的图片 URL 或 @images/@library 引用，空字符串表示清除' },
              headerLogoHeight: { type: 'number', description: '页眉 Logo 高度，单位 px，范围 10-70' },
              headerLogoOpacity: { type: 'number', description: '页眉 Logo 透明度，范围 0-1' },
              headerLeftTextOffset: { type: 'number', description: '页眉左侧文本水平偏移，单位 px' },
              headerLogoTopOffset: { type: 'number', description: '页眉 Logo 顶部偏移，单位 px' },
              footerShow: { type: 'boolean', description: '是否展示页脚' },
              footerLeftText: { type: 'string', description: '页脚左侧文本' },
              footerCenterText: { type: 'string', description: '页脚居中文本' },
              footerRightText: { type: 'string', description: '页脚右侧文本' },
              footerHideOnCover: { type: 'boolean', description: '封面是否隐藏页脚' },
              pageNumberFormat: {
                type: 'string',
                enum: ['page', 'pageOfTotal', 'hyphen', 'simple', 'none'],
                description: '页码显示格式 (page: "第 X 页", pageOfTotal: "第 X 页 / 共 Y 页", hyphen: "- X -", simple: "X / Y", none: "无")'
              },
              pageNumberPosition: {
                type: 'string',
                enum: ['left', 'center', 'right'],
                description: '页码位置'
              }
            }
          }
        }
      },
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

        currentTheme = applyUpdate(currentTheme);
        context.onUpdateTheme(applyUpdate);
        const { header: nextHeader, footer: nextFooter } = currentTheme;

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
      definition: {
        type: 'function',
        function: {
          name: 'update_toc_config',
          description: '配置交付文档的独立目录页参数（是否展示目录、标题文本与字体、1~4 级目录项字体与样式、最大深度、引导线样式、目录后分页等）。',
          parameters: {
            type: 'object',
            properties: {
              show: { type: 'boolean', description: '是否生成并展示文档目录' },
              title: { type: 'string', description: '目录标题文本 (如 "目 录")' },
              titleCenter: { type: 'boolean', description: '目录标题是否居中' },
              titleStyle: {
                type: 'string',
                enum: ['underline', 'accent-block', 'badge', 'minimal'],
                description: '目录标题表达形式'
              },
              titleFont: {
                type: 'object',
                description: '目录页标题的字体、字号、字形与段前段后，可仅提供需要修改的字段',
                properties: {
                  fontFamily: { type: 'string', description: '字体名称，inherit 表示跟随文档字体' },
                  fontSize: { type: 'number', description: '字号 px' },
                  bold: { type: 'boolean', description: '是否加粗' },
                  italic: { type: 'boolean', description: '是否倾斜' },
                  underline: { type: 'boolean', description: '是否加下划线' },
                  marginBefore: { type: 'number', description: '段前间距 px' },
                  marginAfter: { type: 'number', description: '段后间距 px' }
                }
              },
              levelStyles: {
                type: 'array',
                description: '1~4 级目录项的字体与样式，数组第 0~3 项分别对应 1~4 级目录项，可仅提供需要修改的级别与字段',
                items: {
                  type: 'object',
                  properties: {
                    fontFamily: { type: 'string', description: '字体名称，inherit 表示跟随文档字体' },
                    fontSize: { type: 'number', description: '字号 px' },
                    bold: { type: 'boolean', description: '是否加粗' },
                    italic: { type: 'boolean', description: '是否倾斜' },
                    underline: { type: 'boolean', description: '是否加下划线' },
                    marginBefore: { type: 'number', description: '段前间距 px' },
                    marginAfter: { type: 'number', description: '段后间距 px' },
                    paddingLeft: { type: 'number', description: '左缩进 px' }
                  }
                }
              },
              maxDepth: { type: 'number', enum: [1, 2, 3, 4], description: '目录提取的最大标题深度' },
              headingNumbering: {
                type: 'string',
                enum: ['none', 'decimal', 'chinese', 'decimal-skip-h1'],
                description: '目录和标题的自动编号方式'
              },
              leaderStyle: {
                type: 'string',
                enum: ['dots', 'dashes', 'line', 'none'],
                description: '目录项与页码之间的连接引导线样式'
              },
              showPageNumbers: { type: 'boolean', description: '是否显示目录项页码' },
              pageBreakAfter: { type: 'boolean', description: '目录页结束后是否强制分页另起一页' },
              titleOnEveryPage: { type: 'boolean', description: '目录分成多页时是否每页都显示目录标题（默认 false，仅第一页显示）' }
            }
          }
        }
      },
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

        currentTheme = applyUpdate(currentTheme);
        context.onUpdateTheme(applyUpdate);
        const nextToc = currentTheme.toc;
        const titleFont = getTocTitleFont(nextToc);
        const levelStyles = getTocLevelStyles(nextToc);
        const checks: UpdateVerification[] = [];
        const fieldMap: Record<string, unknown> = {
          show: nextToc.show, title: nextToc.title, titleCenter: nextToc.titleCenter, titleStyle: nextToc.titleStyle,
          titleFont, levelStyles, maxDepth: nextToc.maxDepth, headingNumbering: nextToc.headingNumbering,
          leaderStyle: nextToc.leaderStyle, showPageNumbers: nextToc.showPageNumbers,
          pageBreakAfter: nextToc.pageBreakAfter, titleOnEveryPage: nextToc.titleOnEveryPage,
        };
        Object.entries(args).forEach(([field, expected]) => addUpdateVerification(checks, field, expected, fieldMap[field]));
        return formatUpdateVerification(checks);
      }
    }
  ];
}
