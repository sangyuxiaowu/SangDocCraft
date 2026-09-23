import { AiToolExecutionError } from '../types/ai';

/**
 * AI 更新类工具的字段规格表。
 *
 * 同一份规格同时驱动三处，避免「schema、写入逻辑、更新校验」三份清单各自维护而走样：
 * 1. `aiToolDefinitions.ts` 生成 JSON Schema 的 parameters；
 * 2. `aiAssistantService.ts` 按路径写入主题（含白名单、枚举与范围校验）；
 * 3. 写入后的字段级回读校验。
 */

/** 主题中可被 AI 工具直接改写的分区 */
export type ThemeSection = 'meta' | 'cover' | 'header' | 'footer' | 'toc' | 'style';

type ScalarKind = 'string' | 'number' | 'boolean' | 'enum';

export interface FieldConstraint {
  kind: ScalarKind;
  /** kind 为 enum 时的合法取值 */
  values?: readonly (string | number)[];
  pattern?: string;
  min?: number;
  max?: number;
}

export interface ScalarFieldSpec extends FieldConstraint {
  /** 工具参数名 */
  argument: string;
  section: ThemeSection;
  /** 写入主题的字段名，缺省与 argument 相同 */
  field?: string;
  description: string;
}

interface SubFieldSpec extends FieldConstraint {
  description?: string;
}

export type SubFieldSpecs = Record<string, SubFieldSpec>;

function assertRange(name: string, value: number, constraint: FieldConstraint): void {
  if (constraint.min !== undefined && value < constraint.min) {
    throw new AiToolExecutionError('invalid_arguments', `${name} 不能小于 ${constraint.min}。`);
  }
  if (constraint.max !== undefined && value > constraint.max) {
    throw new AiToolExecutionError('invalid_arguments', `${name} 不能大于 ${constraint.max}。`);
  }
}

/** 校验并归一化单个字段值：类型不符、枚举非法、超出范围都会抛出 invalid_arguments，让模型自行纠正 */
export function readFieldValue(
  name: string,
  constraint: FieldConstraint,
  value: unknown,
): string | number | boolean {
  switch (constraint.kind) {
    case 'string': {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new AiToolExecutionError('invalid_arguments', `${name} 必须是字符串。`);
      }
      const text = String(value);
      if (constraint.pattern && !new RegExp(constraint.pattern).test(text)) {
        throw new AiToolExecutionError('invalid_arguments', `${name} 格式无效，应为 #RRGGBB。`);
      }
      return text;
    }
    case 'boolean': {
      if (typeof value === 'boolean') return value;
      if (value === 'true' || value === 'false') return value === 'true';
      throw new AiToolExecutionError('invalid_arguments', `${name} 必须是布尔值。`);
    }
    case 'number': {
      const numeric = typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
      if (!Number.isFinite(numeric)) {
        throw new AiToolExecutionError('invalid_arguments', `${name} 必须是数字。`);
      }
      assertRange(name, numeric, constraint);
      return numeric;
    }
    case 'enum': {
      const values = constraint.values ?? [];
      if (!values.includes(value as string | number)) {
        throw new AiToolExecutionError(
          'invalid_arguments',
          `${name} 取值非法：${JSON.stringify(value)}。可选值：${values.join('、')}。`,
        );
      }
      return value as string | number;
    }
  }
}

/** 只保留规格表里声明过的子字段（忽略模型多传的键），并逐个校验 */
export function pickSubFields(requested: unknown, specs: SubFieldSpecs): Record<string, string | number | boolean> {
  if (typeof requested !== 'object' || requested === null || Array.isArray(requested)) return {};
  const source = requested as Record<string, unknown>;
  const picked: Record<string, string | number | boolean> = {};
  Object.entries(specs).forEach(([key, spec]) => {
    if (source[key] === undefined) return;
    picked[key] = readFieldValue(key, spec, source[key]);
  });
  return picked;
}

const FONT_SHAPE_FIELDS: SubFieldSpecs = {
  fontFamily: { kind: 'string', description: '字体名称，inherit 表示跟随文档字体' },
  fontSize: { kind: 'number', min: 1, description: '字号 px' },
  bold: { kind: 'boolean', description: '是否加粗' },
  italic: { kind: 'boolean', description: '是否倾斜' },
  underline: { kind: 'boolean', description: '是否加下划线' },
  marginBefore: { kind: 'number', description: '段前间距 px' },
  marginAfter: { kind: 'number', description: '段后间距 px' },
};

/** H1-H4 标题字体 */
export const HEADING_FONT_FIELDS: SubFieldSpecs = FONT_SHAPE_FIELDS;

/** 目录项字体（比标题多一个左缩进） */
export const TOC_LEVEL_FONT_FIELDS: SubFieldSpecs = {
  ...FONT_SHAPE_FIELDS,
  paddingLeft: { kind: 'number', description: '左缩进 px' },
};

export const IMAGE_CONFIG_FIELDS: SubFieldSpecs = {
  borderStyle: { kind: 'enum', values: ['none', 'solid', 'subtle', 'shadow', 'card', 'rounded'] },
  borderColor: { kind: 'string' },
  showCaption: { kind: 'boolean' },
  autoNumber: { kind: 'boolean' },
  numberPrefix: { kind: 'string' },
  captionAlign: { kind: 'enum', values: ['center', 'left', 'right'] },
};

export const TABLE_CAPTION_FIELDS: SubFieldSpecs = {
  showCaption: { kind: 'boolean' },
  autoNumber: { kind: 'boolean' },
  numberPrefix: { kind: 'string' },
  captionPosition: { kind: 'enum', values: ['top', 'bottom'] },
  captionAlign: { kind: 'enum', values: ['center', 'left', 'right'] },
};

export const WATERMARK_FIELDS: SubFieldSpecs = {
  show: { kind: 'boolean' },
  type: { kind: 'enum', values: ['text', 'image'] },
  text: { kind: 'string' },
  fontSize: { kind: 'number', min: 1 },
  color: { kind: 'string' },
  opacity: { kind: 'number', min: 0, max: 1 },
  rotate: { kind: 'number', min: -360, max: 360 },
  layout: { kind: 'enum', values: ['single', 'repeat'] },
  repeatGap: { kind: 'number', min: 0 },
  hideOnCover: { kind: 'boolean' },
  imageUrl: { kind: 'string' },
  imageWidth: { kind: 'number', min: 1 },
};

export const MERMAID_FIELDS: SubFieldSpecs = {
  theme: { kind: 'enum', values: ['neutral', 'default', 'dark', 'forest', 'base', 'custom'], description: '文档默认 Mermaid 图表主题' },
};

const MERMAID_HEX_COLOR = { kind: 'string' as const, pattern: '^#[0-9a-fA-F]{6}$' };

export const MERMAID_COLOR_FIELDS: SubFieldSpecs = {
  primaryColor: { ...MERMAID_HEX_COLOR, description: '主节点背景色，如 #2563eb' },
  primaryTextColor: { ...MERMAID_HEX_COLOR, description: '主节点文字色，如 #ffffff' },
  primaryBorderColor: { ...MERMAID_HEX_COLOR, description: '节点边框色，如 #1d4ed8' },
  lineColor: { ...MERMAID_HEX_COLOR, description: '连线与箭头色，如 #64748b' },
  secondaryColor: { ...MERMAID_HEX_COLOR, description: '次级节点背景色，如 #f1f5f9' },
  tertiaryColor: { ...MERMAID_HEX_COLOR, description: '第三层节点背景色，如 #e2e8f0' },
  background: { ...MERMAID_HEX_COLOR, description: '图表底板背景色，如 #ffffff' },
};

export const META_FIELDS: readonly ScalarFieldSpec[] = [
  { argument: 'title', section: 'meta', kind: 'string', description: '主标题' },
  { argument: 'subtitle', section: 'meta', kind: 'string', description: '副标题' },
  { argument: 'author', section: 'meta', kind: 'string', description: '作者姓名' },
  { argument: 'department', section: 'meta', kind: 'string', description: '所属部门' },
  { argument: 'organization', section: 'meta', kind: 'string', description: '机构/公司名称' },
  { argument: 'date', section: 'meta', kind: 'string', description: '日期 (如 2025-05-20)' },
  { argument: 'version', section: 'meta', kind: 'string', description: '版本号 (如 v1.0.0)' },
  { argument: 'number', section: 'meta', kind: 'string', description: '文档编号 (如 DOC-2025-001)' },
  { argument: 'showCover', section: 'cover', kind: 'boolean', description: '是否展示独立封面页' },
  { argument: 'coverStyle', section: 'cover', kind: 'string', description: '封面样式风格，值应来自当前可用封面模板 ID' },
  { argument: 'logoUrl', section: 'cover', kind: 'string', description: '封面 Logo 的图片 URL 或 @images/@library 引用，空字符串表示清除' },
  { argument: 'logoHeight', section: 'cover', kind: 'number', min: 20, max: 120, description: '封面 Logo 高度，单位 px，范围 20-120' },
  { argument: 'coverListColumns', section: 'cover', kind: 'enum', values: [1, 2], description: '封面属性列表列数' },
];

export const STYLE_FIELDS: readonly ScalarFieldSpec[] = [
  { argument: 'primaryColor', section: 'style', kind: 'string', description: '主色调 hex (如 #1e293b, #0369a1)' },
  { argument: 'accentColor', section: 'style', kind: 'string', description: '强调色 hex (如 #2563eb, #0ea5e9)' },
  { argument: 'textColor', section: 'style', kind: 'string', description: '正文文字颜色 hex (如 #0f172a, #334155)' },
  { argument: 'fontSize', section: 'style', kind: 'number', min: 1, description: '正文基础字号，单位 px (如 13, 14, 15)' },
  { argument: 'lineHeight', section: 'style', kind: 'number', min: 0.5, max: 5, description: '行高比例 (如 1.6, 1.8)' },
  { argument: 'paragraphMarginBefore', section: 'style', kind: 'number', description: '正文段前间距，单位 px，默认 0' },
  { argument: 'paragraphMarginAfter', section: 'style', kind: 'number', description: '正文段后间距，单位 px，默认 6' },
  { argument: 'fontFamily', section: 'style', kind: 'enum', values: ['sans', 'serif', 'kaiti', 'heiti', 'mono'], description: '正文字体类型' },
  { argument: 'h1Style', section: 'style', kind: 'enum', values: ['underline', 'accent-block', 'badge', 'minimal'], description: '一级标题外观风格' },
  { argument: 'h2Style', section: 'style', kind: 'enum', values: ['border-left', 'underline-subtle', 'plain'], description: '二级标题外观风格' },
  { argument: 'latinFontFamily', section: 'style', kind: 'string', description: '英文与数字字体名称，如 Times New Roman' },
  { argument: 'bodyFontFamily', section: 'style', kind: 'string', description: '正文字体 CSS font-family，inherit 表示跟随文档字体' },
  { argument: 'indentParagraph', section: 'style', kind: 'boolean', description: '正文首行缩进 2 字符' },
  { argument: 'h1PageBreak', section: 'style', kind: 'boolean', description: '一级标题自动另起一页' },
  { argument: 'h1Center', section: 'style', kind: 'boolean', description: '一级标题居中' },
  { argument: 'paginationMode', section: 'style', kind: 'enum', values: ['auto', 'manual'], description: '自动分页或仅按 pagebreak 手动分页' },
  { argument: 'bulletStyle', section: 'style', kind: 'enum', values: ['dot', 'square', 'checkmark', 'arrow'], description: '无序列表图标样式' },
  { argument: 'numberStyle', section: 'style', kind: 'enum', values: ['decimal', 'paren', 'chinese'], description: '有序列表编号样式' },
  { argument: 'codeTheme', section: 'style', kind: 'enum', values: ['dark', 'light'], description: '代码块主题' },
  { argument: 'tableStyle', section: 'style', kind: 'enum', values: ['striped', 'bordered', 'minimal'], description: '表格样式' },
];

export const HEADER_FIELDS: readonly ScalarFieldSpec[] = [
  { argument: 'headerShow', section: 'header', field: 'show', kind: 'boolean', description: '是否展示页眉' },
  { argument: 'headerLeftText', section: 'header', field: 'leftText', kind: 'string', description: '页眉左侧文本' },
  { argument: 'headerCenterText', section: 'header', field: 'centerText', kind: 'string', description: '页眉居中文本' },
  { argument: 'headerRightText', section: 'header', field: 'rightText', kind: 'string', description: '页眉右侧文本' },
  { argument: 'headerLineStyle', section: 'header', field: 'lineStyle', kind: 'enum', values: ['solid', 'accent', 'double', 'none'], description: '页眉分隔线样式' },
  { argument: 'headerHideOnCover', section: 'header', field: 'hideOnCover', kind: 'boolean', description: '封面是否隐藏页眉' },
  { argument: 'headerLogoUrl', section: 'header', field: 'logoUrl', kind: 'string', description: '页眉 Logo 的图片 URL 或 @images/@library 引用，空字符串表示清除' },
  { argument: 'headerLogoHeight', section: 'header', field: 'logoHeight', kind: 'number', min: 10, max: 70, description: '页眉 Logo 高度，单位 px，范围 10-70' },
  { argument: 'headerLogoOpacity', section: 'header', field: 'logoOpacity', kind: 'number', min: 0, max: 1, description: '页眉 Logo 透明度，范围 0-1' },
  { argument: 'headerLeftTextOffset', section: 'header', field: 'leftTextOffset', kind: 'number', description: '页眉左侧文本水平偏移，单位 px' },
  { argument: 'headerLogoTopOffset', section: 'header', field: 'logoTopOffset', kind: 'number', description: '页眉 Logo 顶部偏移，单位 px' },
];

export const FOOTER_FIELDS: readonly ScalarFieldSpec[] = [
  { argument: 'footerShow', section: 'footer', field: 'show', kind: 'boolean', description: '是否展示页脚' },
  { argument: 'footerLeftText', section: 'footer', field: 'leftText', kind: 'string', description: '页脚左侧文本' },
  { argument: 'footerCenterText', section: 'footer', field: 'centerText', kind: 'string', description: '页脚居中文本' },
  { argument: 'footerRightText', section: 'footer', field: 'rightText', kind: 'string', description: '页脚右侧文本' },
  { argument: 'footerHideOnCover', section: 'footer', field: 'hideOnCover', kind: 'boolean', description: '封面是否隐藏页脚' },
  { argument: 'pageNumberFormat', section: 'footer', field: 'pageNumberFormat', kind: 'enum', values: ['page', 'pageOfTotal', 'hyphen', 'simple', 'none'], description: '页码显示格式 (page: "第 X 页", pageOfTotal: "第 X 页 / 共 Y 页", hyphen: "- X -", simple: "X / Y", none: "无")' },
  { argument: 'pageNumberPosition', section: 'footer', field: 'pageNumberPosition', kind: 'enum', values: ['left', 'center', 'right'], description: '页码位置' },
];

export const TOC_FIELDS: readonly ScalarFieldSpec[] = [
  { argument: 'show', section: 'toc', kind: 'boolean', description: '是否生成并展示文档目录' },
  { argument: 'title', section: 'toc', kind: 'string', description: '目录标题文本 (如 "目 录")' },
  { argument: 'titleCenter', section: 'toc', kind: 'boolean', description: '目录标题是否居中' },
  { argument: 'titleStyle', section: 'toc', kind: 'enum', values: ['underline', 'accent-block', 'badge', 'minimal'], description: '目录标题表达形式' },
  { argument: 'maxDepth', section: 'toc', kind: 'enum', values: [1, 2, 3, 4], description: '目录提取的最大标题深度' },
  { argument: 'headingNumbering', section: 'toc', kind: 'enum', values: ['none', 'decimal', 'chinese', 'decimal-skip-h1'], description: '目录和标题的自动编号方式' },
  { argument: 'leaderStyle', section: 'toc', kind: 'enum', values: ['dots', 'dashes', 'line', 'none'], description: '目录项与页码之间的连接引导线样式' },
  { argument: 'showPageNumbers', section: 'toc', kind: 'boolean', description: '是否显示目录项页码' },
  { argument: 'pageBreakAfter', section: 'toc', kind: 'boolean', description: '目录页结束后是否强制分页另起一页' },
  { argument: 'titleOnEveryPage', section: 'toc', kind: 'boolean', description: '目录分成多页时是否每页都显示目录标题（默认 false，仅第一页显示）' },
];
