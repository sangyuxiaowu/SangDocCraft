---
id: builtin-metrics
title: "关键指标"
description: "数据统计块，展示关键指标。"
order: 20
---
<style>
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.kpi{
  border:1px solid var(--img-border-color);border-radius:10px;padding:12px 14px;
  background:linear-gradient(180deg,#fff,#f6f8fb);position:relative;overflow:hidden;
}
.kpi .kpi-label{font-size:11px;color:#5b6b7b}
.kpi .kpi-value{font-size:22px;font-weight:800;color:var(--text-color);margin-top:3px;line-height:1.1}
.kpi .kpi-value .unit{font-size:12px;font-weight:600;margin-left:2px}
.kpi .kpi-note{font-size:10.5px;color:#8b98a6;margin-top:3px}
</style>
<div class="kpi-grid">
<div class="kpi"><div class="kpi-label">本期合同额</div><div class="kpi-value">¥128.6<span class="unit">万</span></div><div class="kpi-note">较上期 +12.4%</div></div>
<div class="kpi"><div class="kpi-label">已完成节点</div><div class="kpi-value">86<span class="unit">项</span></div><div class="kpi-note">占比 78.2%</div></div>
<div class="kpi alt"><div class="kpi-label">待处理问题</div><div class="kpi-value">12<span class="unit">条</span></div><div class="kpi-note">含 2 条高优先级</div></div>
<div class="kpi"><div class="kpi-label">项目满意度</div><div class="kpi-value">4.8<span class="unit">/5</span></div><div class="kpi-note">有效样本 43 份</div></div>
</div>