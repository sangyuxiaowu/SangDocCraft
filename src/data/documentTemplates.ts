import type { CoverConfig, DocumentMeta, DocumentTheme, FooterConfig, HeaderConfig, StyleConfig, TocConfig } from '../types';
import { DEFAULT_DOCUMENT_META } from './defaultDocumentMeta';

// 每个模板的 Markdown 正文独立存放在 ./templates/*.md，便于单独维护与编辑。
import blankMarkdown from './templates/blank.md?raw';
import systemGuideMarkdown from './templates/system-guide.md?raw';
import enterpriseDeliveryMarkdown from './templates/enterprise-delivery.md?raw';
import minimalWhitepaperMarkdown from './templates/minimal-whitepaper.md?raw';
import architectureSpecMarkdown from './templates/architecture-spec.md?raw';
import approvalDeliveryMarkdown from './templates/approval-delivery.md?raw';
import uiDesignTokenMarkdown from './templates/ui-design-token.md?raw';
import businessProposalMarkdown from './templates/business-proposal.md?raw';
import academicThesisMarkdown from './templates/academic-thesis.md?raw';
import meetingMinutesMarkdown from './templates/meeting-minutes.md?raw';
import prdSpecificationMarkdown from './templates/prd-specification.md?raw';
import incidentPostmortemMarkdown from './templates/incident-postmortem.md?raw';
import operationSopMarkdown from './templates/operation-sop.md?raw';
import projectWeeklyReportMarkdown from './templates/project-weekly-report.md?raw';
import dataAnalysisReportMarkdown from './templates/data-analysis-report.md?raw';

export type DocumentTemplateCategory =
  | 'blank'
  | 'guide'
  | 'development'
  | 'design'
  | 'delivery'
  | 'business'
  | 'meeting'
  | 'academic';

export const DOCUMENT_TEMPLATE_CATEGORIES: ReadonlyArray<{
  id: DocumentTemplateCategory;
  label: string;
}> = [
  { id: 'blank', label: '空白' },
  { id: 'guide', label: '指南' },
  { id: 'development', label: '研发' },
  { id: 'design', label: '设计' },
  { id: 'delivery', label: '交付' },
  { id: 'business', label: '商务' },
  { id: 'meeting', label: '会议' },
  { id: 'academic', label: '学术' },
];

export interface DocumentTemplateItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: DocumentTemplateCategory;
  badge?: string;
  iconName: 'file-text' | 'cpu' | 'palette' | 'briefcase' | 'graduation-cap' | 'clipboard-list' | 'sparkles';
  /** 必须与内置主题（PRESET_THEMES）中的 id 完全一致，否则新建文档会退回默认主题 */
  recommendedThemeId: string;
  markdown: string;
  /** 文档属性差异项：仅声明需要偏离推荐主题的字段。 */
  metaConfig?: Partial<DocumentMeta>;
  /** 封面差异项：仅声明需要偏离推荐主题的字段（如 showCover: false 关闭封面） */
  coverConfig?: Partial<CoverConfig>;
  headerConfig?: Partial<HeaderConfig>;
  footerConfig?: Partial<FooterConfig>;
  /** 目录差异项：仅声明需要偏离推荐主题的字段（如 show: false 关闭目录） */
  tocConfig?: Partial<TocConfig>;
  /** 正文排版差异项：仅声明需要偏离推荐主题的字段（如 h1Center: true 一级标题居中） */
  styleConfig?: Partial<StyleConfig>;
}

/** 模板中心默认推荐主题，供兜底与测试使用 */
export const DEFAULT_TEMPLATE_THEME_ID = 'enterprise-standard';

export interface ResolvedDocumentTemplate {
  theme: DocumentTheme;
  meta: DocumentMeta;
}

/**
 * 依据模板差异项合成新文档主题：
 * 模板只描述差异部分，封面 / 目录 / 正文样式仅覆盖模板显式声明的字段，
 * 其余排版、配色、页眉页脚完全沿用推荐主题。
 */
export function resolveDocumentTemplate(
  template: DocumentTemplateItem,
  baseTheme: DocumentTheme,
): ResolvedDocumentTemplate {
  return {
    theme: {
      ...baseTheme,
      cover: { ...baseTheme.cover, ...template.coverConfig },
      header: { ...baseTheme.header, ...template.headerConfig },
      footer: { ...baseTheme.footer, ...template.footerConfig },
      toc: { ...baseTheme.toc, ...template.tocConfig },
      style: { ...baseTheme.style, ...template.styleConfig },
    },
    meta: {
      ...DEFAULT_DOCUMENT_META,
      ...template.metaConfig,
      title: template.metaConfig?.title || template.title,
      subtitle: template.metaConfig?.subtitle || template.subtitle,
      version: template.metaConfig?.version || 'v1.0.0',
      date: template.metaConfig?.date || new Date().toISOString().split('T')[0],
    },
  };
}

export const DOCUMENT_TEMPLATES: DocumentTemplateItem[] = [
  {
    id: 'blank',
    title: '空白文档',
    subtitle: 'Blank Document',
    description: '从干净纯粹的白纸开始创作，不带任何预设内容，随心设计排版。',
    category: 'blank',
    badge: '纯净开始',
    iconName: 'file-text',
    recommendedThemeId: 'minimal-clean',
    markdown: blankMarkdown,
    headerConfig: { leftText: '', centerText: '', rightText: '' },
    footerConfig: { leftText: '', centerText: '', rightText: '' },
    metaConfig: {
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
    category: 'guide',
    badge: '官方推荐',
    iconName: 'sparkles',
    recommendedThemeId: 'enterprise-standard',
    markdown: systemGuideMarkdown,
    metaConfig: {
      title: 'SangDocCraft 文档交付系统',
      subtitle: '全特性排版范本与交付规范指引',
      author: 'SangDocCraft Team',
      organization: '开源文档工作组',
      version: 'v1.0.0',
    },
  },
  {
    id: 'enterprise-delivery',
    title: '企业标准技术交付文档',
    subtitle: 'Enterprise Delivery Document',
    description: '面向企业项目设计、实施与验收的标准交付范本，覆盖架构、部署、运维和交付清单。',
    category: 'delivery',
    badge: '企业交付',
    iconName: 'file-text',
    recommendedThemeId: 'enterprise-standard',
    markdown: enterpriseDeliveryMarkdown,
    metaConfig: {
      title: '分布式高并发系统架构设计说明书',
      subtitle: '核心服务升级与敏捷架构交付标准',
      author: '架构设计专家团队',
      department: '技术研发中心 / 基础架构部',
      organization: '某某科技有限公司',
      date: '2026年08月12日',
    },
  },
  {
    id: 'minimal-whitepaper',
    title: '极简产品设计白皮书',
    subtitle: 'Minimal Product Whitepaper',
    description: '强调留白与内容层级的轻量白皮书范本，适合产品规范、设计原则和团队共识文档。',
    category: 'design',
    badge: '极简白皮书',
    iconName: 'palette',
    recommendedThemeId: 'minimal-clean',
    markdown: minimalWhitepaperMarkdown,
    metaConfig: {
      title: 'UI/UX 交互设计规范交付指南',
      subtitle: 'Design System & Component Guidelines',
      author: 'UI/UX Design Studio',
      department: '体验设计部',
      organization: '某某科技有限公司',
      date: '2026.08',
    },
  },
  {
    id: 'architecture-spec',
    title: '企业级微服务架构方案',
    subtitle: 'Architecture Specification',
    description: '高规格技术方案范文，包含系统背景、KPI 指标对比表、Mermaid 四层逻辑架构图、API 契约及 SQL 结构。',
    category: 'development',
    badge: '架构设计',
    iconName: 'cpu',
    recommendedThemeId: 'tech-spec',
    markdown: architectureSpecMarkdown,
    metaConfig: {
      title: '企业级云原生微服务中台',
      subtitle: '高可用分布式系统总体架构设计说明书',
      author: '核心架构委员会',
      organization: '技术基础架构部',
      version: 'v2.4.0',
    },
  },
  {
    id: 'approval-delivery',
    title: '企业信息化项目签审交付方案',
    subtitle: 'Project Approval & Delivery',
    description: '覆盖方案评审、职责签批、交付清单、验收标准与版本记录的正式受控文档。',
    category: 'delivery',
    badge: '签审交付',
    iconName: 'file-text',
    recommendedThemeId: 'enterprise-signature',
    markdown: approvalDeliveryMarkdown,
    metaConfig: {
      title: '企业信息化项目建设方案',
      subtitle: '项目评审、签批与交付说明',
      author: '项目交付组',
      department: '企业数字化中心',
      organization: '某某科技有限公司',
      number: 'SDC-2026-001',
      version: 'V1.0',
    },
  },
  {
    id: 'ui-design-token',
    title: '体验设计原则与 Token 规范',
    subtitle: 'Design System & Tokens',
    description: '专业设计系统指南，涵盖视觉克制原则、8px 网格规范、色彩对比度 Token 表格与核心交互组件规则。',
    category: 'design',
    badge: 'UI / UX',
    iconName: 'palette',
    recommendedThemeId: 'creative-studio',
    markdown: uiDesignTokenMarkdown,
    metaConfig: {
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
    category: 'business',
    badge: '商业策划',
    iconName: 'briefcase',
    recommendedThemeId: 'business-briefing',
    markdown: businessProposalMarkdown,
    metaConfig: {
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
    category: 'academic',
    badge: '学术论文',
    iconName: 'graduation-cap',
    recommendedThemeId: 'academic-paper',
    markdown: academicThesisMarkdown,
    metaConfig: {
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
    category: 'meeting',
    badge: '办公协作',
    iconName: 'clipboard-list',
    recommendedThemeId: 'governmental-standard',
    markdown: meetingMinutesMarkdown,
    metaConfig: {
      title: '技术架构委员会专项评审纪要',
      subtitle: 'Q3 容量评估与云原生中台演化研讨',
      author: '架构评审秘书处',
      organization: '技术委员会',
      number: '技委会纪〔2026〕37 号',
      version: '第 37 期',
    },
    coverConfig: {
      // 纪要类文档无需封面，直接从标题进入正文
      showCover: false,
    },
    // 纪要篇幅短、结构清晰，省略目录
    tocConfig: {
      show: false,
    },
    // 纪要标题居中排布，更贴近公文与会议纪要惯例
    styleConfig: {
      h1Center: true,
    },
  },
  {
    id: 'prd-specification',
    title: '产品需求规格说明书 (PRD)',
    subtitle: 'Product Requirements Document',
    description: '标准规范的产品需求文档，涵盖背景目标、用户画像、特性优先级矩阵、状态流转与数据埋点规范。',
    category: 'development',
    badge: '产品规划',
    iconName: 'clipboard-list',
    recommendedThemeId: 'tech-spec',
    markdown: prdSpecificationMarkdown,
    metaConfig: {
      title: '企业级协同文档与知识中台',
      subtitle: '产品需求规格说明书 (PRD)',
      author: '高级产品经理 (PM)',
      department: '产品体验与创新部',
      organization: '某某科技有限公司',
      version: 'v2.1.0',
    },
  },
  {
    id: 'incident-postmortem',
    title: '生产重大故障复盘与根因分析 (RCA)',
    subtitle: 'Incident Postmortem & RCA',
    description: '面向高可用保障与 SRE 团队的故障复盘规范：事件基本信息、精确时间线、5-Whys 递进根因剖析与纠正预防措施（CAPA）。',
    category: 'development',
    badge: 'SRE 复盘',
    iconName: 'cpu',
    recommendedThemeId: 'enterprise-signature',
    markdown: incidentPostmortemMarkdown,
    metaConfig: {
      title: '生产环境重大故障复盘与根因分析报告',
      subtitle: '在线支付网关服务异常事件调查与改进措施 (CAPA)',
      author: '高可用保障专家组',
      department: '基础技术中心 / SRE 运维保障部',
      organization: '某某科技有限公司',
      number: 'INC-20260918-001',
      version: '正式归档版',
    },
  },
  {
    id: 'operation-sop',
    title: '生产运维应急排障标准化手册 (SOP)',
    subtitle: 'Standard Operating Procedure',
    description: '严谨结构化的生产运维与应急响应标准操作规程：应急等级联动矩阵、排障决策流、标准处置命令手册与服务恢复 Checklist。',
    category: 'delivery',
    badge: '运维规程',
    iconName: 'file-text',
    recommendedThemeId: 'enterprise-standard',
    markdown: operationSopMarkdown,
    metaConfig: {
      title: '生产运维应急排障标准操作规程 (SOP)',
      subtitle: '核心微服务集群突发流量与系统高负载应急处置指引',
      author: '基础设施与运维委员会',
      department: '系统工程部',
      organization: '某某科技有限公司',
      number: 'SOP-OPS-2026-08',
      version: 'v3.0',
    },
  },
  {
    id: 'project-weekly-report',
    title: '研发项目周报与阶段性述职看板',
    subtitle: 'Weekly Status & Milestone Progress',
    description: '高效聚焦的项目汇报范式：项目健康度看板、本周核心交付成果、质量效能指标环比、阻塞风险规避与下周攻坚清单。',
    category: 'meeting',
    badge: '工作周报',
    iconName: 'briefcase',
    recommendedThemeId: 'business-briefing',
    markdown: projectWeeklyReportMarkdown,
    metaConfig: {
      title: '核心研发项目周报与阶段性述职看板',
      subtitle: '2026 年第 38 周项目里程碑推进与效能度量',
      author: '技术交付总监 / PMO',
      organization: '研发管理中心',
      version: '2026-W38',
    },
    coverConfig: {
      showCover: false,
    },
    tocConfig: {
      show: false,
    },
    styleConfig: {
      h1Center: true,
    },
  },
  {
    id: 'data-analysis-report',
    title: '业务核心指标分析与经营洞察报告',
    subtitle: 'Business Metrics & Growth Insights',
    description: '量化分析与管理层商业洞察范本：核心经营大盘指标对比、全生命周期转化漏斗、多维留存 Cohort 归因与商业增长策略建议。',
    category: 'business',
    badge: '数据洞察',
    iconName: 'sparkles',
    recommendedThemeId: 'business-briefing',
    markdown: dataAnalysisReportMarkdown,
    metaConfig: {
      title: '业务核心指标分析与经营洞察报告',
      subtitle: '2026 上半年度核心业务大盘复盘与增长策略建议',
      author: '商业智能与增长分析部 (BI)',
      department: '战略发展中心',
      organization: '某某科技有限公司',
      version: '2026-H1 经营分析',
    },
  },
];
