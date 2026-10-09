---
id: builtin-team
title: "项目团队架构"
description: "关键项目成员、岗位分工及联络方式卡片。"
order: 15
---
<style>
.team-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.member-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #f8fafc;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--primary-color);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}
.member-info {
  flex: 1;
  min-width: 0;
}
.member-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1.2;
}
.member-role {
  font-size: 11px;
  color: var(--accent-color);
  margin-top: 2px;
}
.member-contact {
  font-size: 10.5px;
  color: #64748b;
  margin-top: 2px;
  font-family: monospace;
}
</style>
<div class="team-grid">
  <div class="member-card">
    <div class="member-avatar">林</div>
    <div class="member-info">
      <div class="member-name">林楚涵</div>
      <div class="member-role">项目总负责人 / PM</div>
      <div class="member-contact">lin.ch@company.com</div>
    </div>
  </div>
  <div class="member-card">
    <div class="member-avatar">陈</div>
    <div class="member-info">
      <div class="member-name">陈思远</div>
      <div class="member-role">首席架构师 / Architect</div>
      <div class="member-contact">chen.sy@company.com</div>
    </div>
  </div>
  <div class="member-card">
    <div class="member-avatar">赵</div>
    <div class="member-info">
      <div class="member-name">赵晓蕾</div>
      <div class="member-role">交付测试组长 / QA Lead</div>
      <div class="member-contact">zhao.xl@company.com</div>
    </div>
  </div>
</div>
<br>