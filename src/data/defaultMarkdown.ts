export const SAMPLE_MARKDOWNS = {
  systemTemplate: `# 文档概述

本文档使用 **Markdown** 编写，可通过右侧面板设置封面、页眉页脚、目录与排版。

## 基础内容

正文默认使用中文字体与 Times New Roman 英文字体。封面属性由 coverlist 自由定义，可插入表格、代码、图片和分页符。

### 图片示例

![示例图片](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80)

#### 交付检查

- 检查目录链接
- 检查页眉页脚
- 导出 Word 后更新目录字段
`,

  architectureDoc: `# 项目概述与设计目标

## 背景说明
本设计文档旨在为 **企业级云原生中台系统** 的升级交付提供标准化架构说明。随着业务流量的快速增长，原有的单体服务架构在吞吐量、容错性与扩展性方面遇到了挑战。

本项目通过引入高可用分布式微服务架构，实现核心交易链路与数据查询链路的解耦，确保系统具备 **99.99% 的高可用性**。

> 💡 **核心原则**：高可用、强一致性、低延迟、可观测性与极简运维。

## 关键性能指标 (KPI)

<!-- caption: 关键性能指标 (KPI) 交付与对比表 -->
| 维度指标 | 当前性能 (旧系统) | 交付目标 (新架构) | 提升幅度 |
| :--- | :--- | :--- | :--- |
| **平均响应时间 (RT)** | 120ms | **< 15ms** | 800% ⚡ |
| **峰值 QPS 承载** | 3,500 req/s | **> 50,000 req/s** | 1,400% |
| **数据库 CPU 占用** | 85% (高危) | **< 35%** (平稳) | -50% |
| **故障自动恢复时间** | > 15 分钟 | **< 3 秒** (RTO) | 99% |

<!-- pagebreak -->

# 系统整体架构设计

## 逻辑架构图视图

![云原生高可用分布式微服务系统总体架构视图](https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80){h=230}

系统采用四层分层架构进行划分，确保控制流与数据流分离：

1. **接入网关层 (API Gateway)**：负责路由转发、鉴权限流与 TLS 卸载。
2. **应用业务层 (Business Microservices)**：基于 Go & Java 实现的高并发无状态微服务。
3. **数据缓存层 (Redis Cluster & Cache)**：多级缓存体系，解决热点数据高并发穿透。
4. **持久化存储层 (MySQL / TiDB / OceanBase)**：主从读写分离与分库分表。

\`\`\`mermaid
flowchart TB
    subgraph Client[客户端层]
        C1[Web / H5]
        C2[移动端 App]
        C3[第三方开放平台]
    end

    subgraph Gateway[接入网关层 API Gateway]
        G1[Nginx / Ingress]
        G2[API 网关<br/>路由转发 · 鉴权限流 · TLS 卸载]
    end

    subgraph App[应用业务层 Business Microservices]
        A1[认证与权限服务<br/>Auth Service]
        A2[订单处理服务<br/>Order Engine]
        A3[用户服务]
        A4[商品服务]
        A5[监控与链路追踪<br/>Observability]
    end

    subgraph Cache[数据缓存层 Redis Cluster / Cache]
        R1[Redis Cluster<br/>热点数据缓存]
        R2[本地缓存 / 多级缓存]
    end

    subgraph Storage[持久化存储层 MySQL / TiDB / OceanBase]
        DB1[(MySQL 主从<br/>读写分离)]
        DB2[(TiDB / OceanBase<br/>分库分表)]
        MQ[(RocketMQ<br/>异步削峰)]
    end

    C1 --> G1
    C2 --> G1
    C3 --> G1
    G1 --> G2
    G2 --> A1
    G2 --> A2
    G2 --> A3
    G2 --> A4
    A1 --> R1
    A2 --> R1
    A3 --> R1
    A4 --> R1
    A1 --> DB1
    A2 --> DB1
    A2 --> MQ
    MQ --> A2
    A3 --> DB2
    A4 --> DB2
    A5 -. 监控指标 / 链路追踪 .-> G2
    A5 -. 监控指标 / 链路追踪 .-> A1
    A5 -. 监控指标 / 链路追踪 .-> A2
\`\`\`

## 核心模块职责分配

\`\`\`mermaid
flowchart LR
    U[用户 / 调用方] --> GW[API 网关]
    GW --> Auth[认证与权限服务<br/>OAuth2.0 + JWT<br/>RBAC 权限控制]
    GW --> Order[订单处理服务<br/>Order Engine]

    Auth -. Token 校验 / 权限结果 .-> Order

    Order --> MQ[(RocketMQ<br/>异步削峰填谷)]
    Order --> Lock[乐观锁 + 分布式锁]
    Lock --> Stock[(库存数据)]
    Order --> OrderDB[(订单数据库)]

    Obs[监控与链路追踪<br/>SkyWalking + Prometheus] -. 指标采集 / 链路追踪 .-> GW
    Obs -. 指标采集 / 链路追踪 .-> Auth
    Obs -. 指标采集 / 链路追踪 .-> Order
\`\`\`

* **认证与权限服务 (Auth Service)**
  * 基于 OAuth2.0 与 JWT 实现分布式统一鉴权。
  * 毫秒级 Token 校验与 RBAC 权限控制。
* **订单处理服务 (Order Engine)**
  * 基于 RocketMQ 异步削峰填谷，应对高并发抢购。
  * 乐观锁 + 分布式锁保障库存扣减原子性。
* **监控与链路追踪 (Observability)**
  * 全链路 SkyWalking 跟踪与 Prometheus 告警指标收集。

# 核心 API 接口与数据模型

## 订单创建 API 规范

\`\`\`json
POST /api/v2/orders/create
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "user_id": "usr_98231029",
  "items": [
    {
      "sku_id": "sku_881923",
      "quantity": 2,
      "unit_price": 299.00
    }
  ],
  "coupon_id": "cpn_202608_10",
  "client_ip": "192.168.1.100"
}
\`\`\`

响应示例：

\`\`\`json
{
  "code": 200,
  "message": "Order created successfully",
  "data": {
    "order_id": "ord_20260812_0091823",
    "status": "PENDING_PAYMENT",
    "total_amount": 588.00,
    "created_at": "2026-08-12T03:30:00Z"
  }
}
\`\`\`

## 数据库核心表结构定义

数据库使用 UTF8MB4 字符集，主键统一为 BIGINT UNSIGNED AUTO_INCREMENT：

\`\`\`sql
CREATE TABLE \`t_orders\` (
  \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  \`order_no\` VARCHAR(64) NOT NULL COMMENT '订单编号 (唯一全局索引)',
  \`user_id\` BIGINT UNSIGNED NOT NULL COMMENT '用户ID',
  \`status\` TINYINT NOT NULL DEFAULT '0' COMMENT '状态: 0-待付 1-已付 2-已发货 3-已取消',
  \`total_amount\` DECIMAL(12,2) NOT NULL COMMENT '订单总金额',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_order_no\` (\`order_no\`),
  KEY \`idx_user_status\` (\`user_id\`, \`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单主表';
\`\`\`

<!-- pagebreak -->

# 实施计划与交付验收标准

## 阶段里程碑规划

1. **第一阶段 (架构准备与环境搭建)**：完成基础 K8s 集群与 CI/CD 流水线搭建。
2. **第二阶段 (核心微服务重构)**：完成订单、库存与鉴权服务开发与单元测试。
3. **第三阶段 (性能全链路压测)**：模拟 10 万级并发，优化全链路瓶颈。
4. **第四阶段 (灰度上线与验收)**：切流 5% -> 20% -> 50% -> 100% 最终交付。

## 交付产物清单

* ✅ **技术文档**：架构说明书、API 接口文档、数据库字典。
* ✅ **源代码**：GitLab 源码仓库，包含 100% 单元测试覆盖。
* ✅ **部署脚本**：Helm Charts, Terraform 脚本与 K8s YAML 配置。
`,

  uiDesignDoc: `# 体验设计原则与 Token 系统

## 设计视觉语言
本规范定义了 **某某设计系统** 的基础视觉组件与交互范式。旨在为全终端应用提供一致、优雅、无障碍（WCAG 2.1 AA）的用户体验。

主要核心理念包括：
* **克制与秩序**：利用严格的 8px 空间网格，消除视觉噪音。
* **清晰的层次**：通过对比度而非杂乱的装饰建立视觉优先级。
* **流畅的反馈**：动效持续时间控制在 200ms - 300ms 之间，赋予自然触感。

## 品牌色彩 Token 定义

| 色彩 Token | Hex 颜色值 | 用途描述 | 对比度 (白底) |
| :--- | :--- | :--- | :--- |
| **Primary Base** | \`#0F172A\` | 主标题、高亮按钮背景 | **15.8:1** (AAA) |
| **Primary Hover** | \`#1E293B\` | 悬停状态与深色卡片 | **13.2:1** (AAA) |
| **Brand Accent** | \`#2563EB\` | 链接、选中态、聚焦光圈 | **4.6:1** (AA) |
| **Success Emerald** | \`#059669\` | 成功提示、进度完成条 | **4.7:1** (AA) |
| **Warning Amber** | \`#D97706\` | 警告状态、警示徽章 | **4.5:1** (AA) |

# 核心组件布局与规则

> ⚠️ **注意**：所有按钮与输入框在移动端触摸目标必须满足至少 **44px × 44px** 的高敏点击区域。

## 按钮 (Button) 变体规范

1. **Primary Button (主要按钮)**：用于单页面唯一的核心 Call to Action 操作。
2. **Secondary Button (次要按钮)**：用于取消、返航、辅助筛选等中性操作。
3. **Outline / Ghost Button (幽灵按钮)**：用于工具栏列表项或图标按钮。

## 状态提示与弹窗

表格形式的通用组件配置：

| 属性 | 默认值 | 可选范围 | 规范说明 |
| :--- | :--- | :--- | :--- |
| **Border Radius** | 8px | 4px, 8px, 12px, 9999px | 卡片统一为 12px，按钮统一为 8px |
| **Box Shadow** | \`0 1px 3px rgba(0,0,0,0.1)\` | None, Sm, Md, Lg | 仅浮层或 Modal 允许使用 Lg 阴影 |
`,
};

