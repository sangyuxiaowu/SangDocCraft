---
id: builtin-timeline
title: "实施里程碑"
description: "时间线进度节点，展示阶段目标与交付日期。"
order: 22
---
<style>
.milestone-timeline {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 4px;
}
.milestone-item {
  display: flex;
  gap: 16px;
  position: relative;
}
.milestone-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 24px;
  bottom: -14px;
  width: 2px;
  background: var(--border-color);
}
.milestone-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--primary-color);
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary-color);
  flex-shrink: 0;
  z-index: 1;
}
.milestone-dot.completed {
  background: var(--primary-color);
  color: #fff;
}
.milestone-content {
  flex: 1;
  background: #f8fafc;
  border: 1px solid var(--border-light, var(--img-border-color));
  border-radius: 8px;
  padding: 10px 14px;
}
.milestone-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.milestone-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-color);
}
.milestone-date {
  font-size: 11px;
  color: var(--accent-color);
  font-family: monospace;
}
.milestone-desc {
  font-size: 11.5px;
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
  margin: 0;
}
</style>
<div class="milestone-timeline">
  <div class="milestone-item">
    <div class="milestone-dot completed">✓</div>
    <div class="milestone-content">
      <div class="milestone-header">
        <span class="milestone-title">阶段一：需求调研与总体设计</span>
        <span class="milestone-date">2026.09.15</span>
      </div>
      <p class="milestone-desc">完成各部门业务需求访谈，形成系统架构蓝图并通过专家组评审。</p>
    </div>
  </div>
  <div class="milestone-item">
    <div class="milestone-dot completed">✓</div>
    <div class="milestone-content">
      <div class="milestone-header">
        <span class="milestone-title">阶段二：核心模块研发与集成测试</span>
        <span class="milestone-date">2026.11.01</span>
      </div>
      <p class="milestone-desc">完成主干业务逻辑开发，联调外部接口，单元测试覆盖率达 85% 以上。</p>
    </div>
  </div>
  <div class="milestone-item">
    <div class="milestone-dot">3</div>
    <div class="milestone-content">
      <div class="milestone-header">
        <span class="milestone-title">阶段三：UAT 用户验收与正式上线</span>
        <span class="milestone-date">2026.12.15</span>
      </div>
      <p class="milestone-desc">组织关键用户开展端到端业务演练，完成数据割接并平稳切入生产运营。</p>
    </div>
  </div>
</div>
<br>