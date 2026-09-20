import type { CoverConfig } from '../types';

// 每个模板的 Markdown 正文独立存放在 ./templates/*.md，便于单独维护与编辑。
import blankMarkdown from './templates/blank.md?raw';
import systemGuideMarkdown from './templates/system-guide.md?raw';
import architectureSpecMarkdown from './templates/architecture-spec.md?raw';
import uiDesignTokenMarkdown from './templates/ui-design-token.md?raw';
import businessProposalMarkdown from './templates/business-proposal.md?raw';
import academicThesisMarkdown from './templates/academic-thesis.md?raw';
import meetingMinutesMarkdown from './templates/meeting-minutes.md?raw';

export type DocumentTemplateCategory = 'blank' | 'template';

export interface DocumentTemplateItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: DocumentTemplateCategory;
  categoryLabel: string;
  badge?: string;
  iconName: 'file-text' | 'cpu' | 'palette' | 'briefcase' | 'graduation-cap' | 'clipboard-list' | 'sparkles';
  /** 必须与内置主题（PRESET_THEMES）中的 id 完全一致，否则新建文档会退回默认主题 */
  recommendedThemeId: string;
  markdown: string;
  coverConfig?: Partial<CoverConfig>;
}

/** 模板中心默认推荐主题，供兜底与测试使用 */
export const DEFAULT_TEMPLATE_THEME_ID = 'enterprise-standard';

export const DOCUMENT_TEMPLATES: DocumentTemplateItem[] = [
  {
    id: 'blank',
    title: '空白文档',
    subtitle: 'Blank Document',
    description: '从干净纯粹的白纸开始创作，不带任何预设内容，随心设计排版。',
    category: 'blank',
    categoryLabel: '新建',
    badge: '纯净开始',
    iconName: 'file-text',
    recommendedThemeId: 'minimal-clean',
    markdown: blankMarkdown,
    coverConfig: {
      title: '未命名文档',
      subtitle: '在此输入文档副标题',
      author: '作者姓名',
      organization: '组织机构 / 团队',
      version: 'v1.0.0',
    },
  },
  {
    id: 'system-guide',
    title: 'SangDocCraft 使用范本',
    subtitle: 'Feature Showcase',
    description: '系统推荐全功能演示文档，包含 Mermaid 流程图、LaTeX 公式、表格与题注、内部/网络图片、分页符及文档历史等特性。',
    category: 'template',
    categoryLabel: '文档模板',
    badge: '官方推荐',
    iconName: 'sparkles',
    recommendedThemeId: 'enterprise-standard',
    markdown: systemGuideMarkdown,
    coverConfig: {
      title: 'SangDocCraft 文档交付系统',
      subtitle: '全特性排版范本与交付规范指引',
      author: 'SangDocCraft Team',
      organization: '开源文档工作组',
      version: 'v1.0.0',
    },
  },
  {
    id: 'architecture-spec',
    title: '企业级微服务架构方案',
    subtitle: 'Architecture Specification',
    description: '高规格技术方案范文，包含系统背景、KPI 指标对比表、Mermaid 四层逻辑架构图、API 契约及 SQL 结构。',
    category: 'template',
    categoryLabel: '文档模板',
    badge: '架构设计',
    iconName: 'cpu',
    recommendedThemeId: 'tech-spec',
    markdown: architectureSpecMarkdown,
    coverConfig: {
      title: '企业级云原生微服务中台',
      subtitle: '高可用分布式系统总体架构设计说明书',
      author: '核心架构委员会',
      organization: '技术基础架构部',
      version: 'v2.4.0',
    },
  },
  {
    id: 'ui-design-token',
    title: '体验设计原则与 Token 规范',
    subtitle: 'Design System & Tokens',
    description: '专业设计系统指南，涵盖视觉克制原则、8px 网格规范、色彩对比度 Token 表格与核心交互组件规则。',
    category: 'template',
    categoryLabel: '文档模板',
    badge: 'UI / UX',
    iconName: 'palette',
    recommendedThemeId: 'creative-studio',
    markdown: uiDesignTokenMarkdown,
    coverConfig: {
      title: '企业级视觉设计语言与规范',
      subtitle: '全终端统一体验原则与 Design Tokens',
      author: '体验设计中心 (UXC)',
      organization: '产品体验部',
      version: 'v1.2.0',
    },
  },
  {
    id: 'business-proposal',
    title: '商业立项与可行性研究报告',
    subtitle: 'Business Feasibility Report',
    description: '涵盖项目执行摘要、行业客户痛点矩阵、商业模式 Mermaid 图、三年财务营收测算及阶段退出规划。',
    category: 'template',
    categoryLabel: '文档模板',
    badge: '商业策划',
    iconName: 'briefcase',
    recommendedThemeId: 'business-briefing',
    markdown: businessProposalMarkdown,
    coverConfig: {
      title: '企业级智能知识中台立项报告',
      subtitle: '技术创新与商业可行性深度论证',
      author: '战略规划与商业发展部',
      organization: '创新业务事业群',
      version: 'v1.0',
    },
  },
  {
    id: 'academic-thesis',
    title: '学术论文与学位开题报告',
    subtitle: 'Academic Thesis Proposal',
    description: '符合学术规范的结构框架：中英文摘要、关键词、国内外研究现状、数学公式说明、架构流程图与对比实验表。',
    category: 'template',
    categoryLabel: '文档模板',
    badge: '学术论文',
    iconName: 'graduation-cap',
    recommendedThemeId: 'academic-paper',
    markdown: academicThesisMarkdown,
    coverConfig: {
      title: '基于检索增强生成的问答系统研究',
      subtitle: '博士/硕士学位开题报告与实验方案',
      author: '课题研究员',
      organization: '计算机科学与工程国家重点实验室',
      version: '开题稿',
    },
  },
  {
    id: 'meeting-minutes',
    title: '重点项目会议纪要与行动看板',
    subtitle: 'Meeting Minutes & Action Items',
    description: '高管与研发周会标准范式：参会基本信息、核心议题讨论结果、责任分工明确的待办事项与进度跟踪清单。',
    category: 'template',
    categoryLabel: '文档模板',
    badge: '办公协作',
    iconName: 'clipboard-list',
    recommendedThemeId: 'governmental-standard',
    markdown: meetingMinutesMarkdown,
    coverConfig: {
      title: '技术架构委员会专项评审纪要',
      subtitle: 'Q3 容量评估与云原生中台演化研讨',
      author: '架构评审秘书处',
      organization: '技术委员会',
      number: '技委会纪〔2026〕37 号',
      version: '第 37 期',
    },
  },
];
