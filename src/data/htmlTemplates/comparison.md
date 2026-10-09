---
id: builtin-comparison
title: "方案对比矩阵"
description: "多方案优劣势分析与选型建议卡片。"
order: 28
---
<style>
.comparison-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.compare-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
}
.compare-card.recommended {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.compare-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--primary-color);
  margin-bottom: 4px;
}
.compare-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 8px;
}
.compare-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #475569;
  line-height: 1.6;
}
.compare-verdict {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px dashed var(--border-color);
  font-size: 11.5px;
  color: var(--text-color);
}
</style>
<div class="comparison-grid">
  <div class="compare-card recommended">
    <div class="compare-badge">★ 推荐采纳</div>
    <div class="compare-title">方案 A：分布式云原生架构</div>
    <ul class="compare-list">
      <li>高弹性可伸缩，支持自动化故障转移</li>
      <li>微服务敏捷发布，降低单点耦合</li>
      <li>初期搭建需统一标准容器化治理</li>
    </ul>
    <div class="compare-verdict"><strong>综合评估：</strong>满足 3 年内业务翻倍扩容诉求，总体拥有成本更优。</div>
  </div>
  <div class="compare-card">
    <div class="compare-badge" style="color:#64748b;">备选方案</div>
    <div class="compare-title">方案 B：传统集中式架构</div>
    <ul class="compare-list">
      <li>现有运维体系成熟，团队学习成本较低</li>
      <li>单机扩展上限有限，高峰期有瓶颈</li>
      <li>硬件投入成本较高，灵活性不足</li>
    </ul>
    <div class="compare-verdict"><strong>综合评估：</strong>适用于过渡期快速上线，中长期需面临二次重构。</div>
  </div>
</div>
<br>