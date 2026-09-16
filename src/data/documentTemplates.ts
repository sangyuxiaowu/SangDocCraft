import { SAMPLE_MARKDOWNS } from './defaultMarkdown';
import type { CoverConfig } from '../types';

export interface DocumentTemplateItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'blank' | 'sample' | 'template';
  categoryLabel: string;
  badge?: string;
  iconName: 'file-text' | 'cpu' | 'palette' | 'briefcase' | 'graduation-cap' | 'clipboard-list' | 'sparkles';
  recommendedThemeId: string;
  markdown: string;
  coverConfig?: Partial<CoverConfig>;
}

export const BUSINESS_PROPOSAL_MARKDOWN = `# 智能企业知识中台项目商业可行性研究报告

## 1. 项目执行摘要

本项目旨在依托前沿的大语言模型与检索增强生成（RAG）技术，为中大型制造与金融企业构建高安全性、开箱即用的**私有化企业知识管理与交付中台**。

通过将散落在即时通讯、邮件、本地 Word 及网盘中的非结构化文档统一沉淀，打造毫秒级响应的智能问答与标准交付物自动生成流水线。

> 💡 **核心商业价值**：降低新员工培训周期 45%，提升跨部门技术检索效率 70%，消除核心业务知识因人员流动流失的系统性风险。

## 2. 目标市场与客户痛点分析

<!-- caption: 目标行业痛点与解决成效评估 -->
| 行业类别 | 核心知识痛点 | 传统解决方案局限 | 本项目中台突破价值 |
| :--- | :--- | :--- | :--- |
| **高端装备制造** | 装配图纸与 SOP 规范庞杂，产线调优依赖资深技师口传心授 | 纸质手册翻阅慢，更新不及时 | 移动端即拍即答，精准定位图纸页码 |
| **金融投资机构** | 研报与合规监管条例日更，人工复核容易遗漏细节 | 关键词检索准确度低于 40% | 向量混合语义检索，100% 溯源引用段落 |
| **高新软件研发** | 微服务架构文档陈旧，接口契约变更频繁导致联调拖沓 | 维基系统年久失修无人维护 | 代码仓库与 API 契约自动同步生成 |

<!-- pagebreak -->

# 3. 商业模式与收益测算

\`\`\`mermaid
flowchart LR
    Customer[企业客户] --> Platform[知识中台私有部署]
    Platform --> Sub1[标准平台授权许可<br/>(基础版 / 专业版)]
    Platform --> Sub2[行业垂直模型微调<br/>(专业服务交付)]
    Platform --> Sub3[年度金牌维保与安全巡检<br/>(持续性订阅收入)]
\`\`\`

## 3.1 财务收益预测 (三年规划)

<!-- caption: 2026 - 2028 年度收支与净利润预测表 (万元人民币) -->
| 年度 | 签约企业数 | 软件授权收入 | 定制服务收入 | 综合运营成本 | 净利润 (EBITDA) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **2026 (基准年)** | 15 家 | 450 万元 | 180 万元 | 420 万元 | **+210 万元** |
| **2027 (成长期)** | 48 家 | 1,440 万元 | 520 万元 | 860 万元 | **+1,100 万元** |
| **2028 (规模化)** | 120 家 | 3,600 万元 | 1,100 万元 | 1,650 万元 | **+3,050 万元** |

## 4. 关键里程碑与退出机制

1. **2026 Q3**：完成 V1.0 架构重构，获得信创安全与等保三级认证。
2. **2026 Q4**：首批 5 家标杆灯塔客户上线运行，形成可复制的最佳实践案例。
3. **2027 Q2**：启动全国区域合作伙伴计划，渠道签约比例超 50%。
`;

export const ACADEMIC_THESIS_MARKDOWN = `# 基于检索增强生成的领域知识问答系统优化研究

## 摘要

在大语言模型（LLM）驱动的领域知识问答任务中，幻觉问题（Hallucination）与垂直领域长尾知识匮乏一直是制约其实际落地的关键瓶颈。检索增强生成（Retrieval-Augmented Generation, RAG）通过引入外部非结构化知识库，有效缓解了模型内部参数知识的时效性缺陷。

本文针对传统密集检索在面对多跳推理与复杂专业术语时召回率低的问题，提出了一种结合多粒度切块（Multi-granularity Chunking）与倒排-向量混合重排（Hybrid Re-ranking）的知识问答优化架构。实验结果表明，在自建的工业标准规范问答数据集上，本文方法的 Exact Match (EM) 提升了 14.8%，且推理响应时间缩短至 280ms 内。

**关键词**：检索增强生成；大语言模型；知识问答；语义重排；跨模态对齐

<!-- pagebreak -->

# 1. 绪论与选题背景

## 1.1 研究背景与意义
随着深度学习技术的飞速演进，以 Transformer 为基座的预训练模型展现出了令人瞩目的自然语言理解与生成能力。然而，在严肃工程与医疗诊断等高风险场景下，模型输出的不可靠性可能导致严重的决策失误。

## 1.2 国内外研究现状
早期研究多关注于基于密集向量检索（Dense Passage Retrieval, DPR）的标准单阶段框架。近期，Lewis 等人提出的基础 RAG 架构展示了参数记忆与非参数记忆结合的优越性...

\`\`\`mermaid
flowchart TD
    Q[用户原始提问] --> Rewrite[Query 改写与语义扩展]
    Rewrite --> BM25[BM25 关键词检索通道]
    Rewrite --> Vector[Dense Vector 向量检索通道]
    BM25 --> Merge[候选段落混合去重]
    Vector --> Merge
    Merge --> Rerank[Cross-Encoder 交叉重排模型]
    Rerank --> Context[Top-K 精选上下文拼接]
    Context --> LLM[生成式大语言模型]
    LLM --> Output[可信可追溯答案输出]
\`\`\`

<!-- pagebreak -->

# 2. 系统核心架构与算法设计

## 2.1 倒排与向量混合检索机制
给定查询 $q$ 与文档库 $D = \\{d_1, d_2, \\dots, d_n\\}$，本文采用如下打分融合公式：

$$S(q, d) = \\alpha \\cdot S_{\\text{dense}}(q, d) + (1 - \\alpha) \\cdot S_{\\text{sparse}}(q, d)$$

其中 $\\alpha \\in [0, 1]$ 为动态可调节的平衡因子。

## 3. 实验结果与对比分析

<!-- caption: 各基线模型在测试集上的性能指标评测对比 -->
| 模型架构 | Hit@3 (%) | Hit@5 (%) | MRR@10 | BLEU-4 | 平均延迟 (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Naive RAG (基准) | 68.2 | 74.5 | 0.612 | 24.1 | 185 |
| Self-RAG | 76.4 | 82.1 | 0.698 | 27.8 | 450 |
| **本文优化模型 (Ours)** | **84.6** | **90.3** | **0.785** | **32.4** | **275** |
`;

export const MEETING_MINUTES_MARKDOWN = `# 核心业务与技术架构评审周会纪要

## 一、会议基本信息

* **会议主题**：2026 Q3 核心微服务容量评估与云原生中台演化研讨
* **会议时间**：2026 年 9 月 16 日 14:00 - 16:30
* **会议地点**：3 号楼 8F 战略研讨厅 / 远程云视频会议室
* **主持人**：研发技术委员会总监
* **记录人**：技术架构组秘书
* **参会人员**：架构组全体专家、交易系统负责人、基础运维专家、安全合规代表

---

## 二、核心讨论议题与决议

### 议题一：大促交易峰值容量承载与 TiDB 分库分表计划
* **现状梳理**：当前 MySQL 单表数据量已达 4,800 万条，单日增量超 60 万条，慢查询比例上升至 2.4%。
* **决议结果**：一致同意启动 TiDB 分库分表平滑切流计划，本周五前完成 Staging 联调验证。

### 议题二：文档标准化交付系统（SangDocCraft）在全司的推广
* **决议结果**：全员统一采用 SangDocCraft 进行架构白皮书、需求规格说明书与交付文档的撰写。

<!-- pagebreak -->

# 三、关键决策行动清单 (Action Items)

<!-- caption: 评审会决议待办事项分派与跟踪表 -->
| 序号 | 行动待办事项 (Task Description) | 主责任人 | 配合部门 | 截止交付时间 | 当前状态 |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **1** | 完成 TiDB 测试集群压测报告与回滚方案编写 | 张工 (交易组) | 基础运维部 | 2026-09-20 | 🟡 进行中 |
| **2** | 梳理交易微服务网关鉴权规则并更新 API 规范文档 | 李工 (架构组) | 信息安全部 | 2026-09-22 | ⚪ 待开始 |
| **3** | 为各业务线部署 SangDocCraft 文档模版中心 | 王工 (工具链) | 全体研发团队 | 2026-09-25 | 🟢 已就绪 |
| **4** | 组织全链路压测复盘与应急预案演练 | 赵总 (技术总监) | 业务条线 PM | 2026-09-30 | ⚪ 待排期 |
`;

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
    recommendedThemeId: 'classicBlue',
    markdown: '# 未命名文档\n\n在此开始输入您的正文内容...\n',
    coverConfig: {
      title: '未命名文档',
      subtitle: '在此输入文档副标题',
      author: '作者姓名',
      organization: '组织机构 / 团队',
      date: new Date().toISOString().split('T')[0],
      version: 'v1.0.0',
    },
  },
  {
    id: 'system-sample',
    title: 'SangDocCraft 使用范本',
    subtitle: 'Feature Showcase',
    description: '系统推荐全功能演示文档，包含 Mermaid 流程图、表格与题注、内部/网络图片、分页符及文档历史等特性。',
    category: 'sample',
    categoryLabel: '精选范文',
    badge: '官方推荐',
    iconName: 'sparkles',
    recommendedThemeId: 'classicBlue',
    markdown: SAMPLE_MARKDOWNS.systemTemplate,
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
    category: 'sample',
    categoryLabel: '精选范文',
    badge: '架构设计',
    iconName: 'cpu',
    recommendedThemeId: 'techBlack',
    markdown: SAMPLE_MARKDOWNS.architectureDoc,
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
    category: 'sample',
    categoryLabel: '精选范文',
    badge: 'UI / UX',
    iconName: 'palette',
    recommendedThemeId: 'vibrantCyan',
    markdown: SAMPLE_MARKDOWNS.uiDesignDoc,
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
    categoryLabel: '实用模板',
    badge: '商业策划',
    iconName: 'briefcase',
    recommendedThemeId: 'elegantDark',
    markdown: BUSINESS_PROPOSAL_MARKDOWN,
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
    categoryLabel: '实用模板',
    badge: '学术论文',
    iconName: 'graduation-cap',
    recommendedThemeId: 'academic',
    markdown: ACADEMIC_THESIS_MARKDOWN,
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
    categoryLabel: '实用模板',
    badge: '办公协作',
    iconName: 'clipboard-list',
    recommendedThemeId: 'minimal',
    markdown: MEETING_MINUTES_MARKDOWN,
    coverConfig: {
      title: '技术架构委员会专项评审纪要',
      subtitle: 'Q3 容量评估与云原生中台演化研讨',
      author: '架构评审秘书处',
      organization: '技术委员会',
      version: '第 37 期',
    },
  },
];
