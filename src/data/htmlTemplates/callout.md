---
id: builtin-callout
title: "重点与风险提示"
description: "文档重要说明、合规提示与风险控制备忘录。"
order: 26
---
<style>
.notice-box {
  border: 1px solid var(--img-border-color);
  border-radius: 8px;
  background: #f8fafc;
  padding: 12px 16px;
  margin: 8px 0;
}
.notice-box.warning {
  border-color: #fdba74;
  background: #fffbeb;
}
.notice-box.info {
  border-color: #93c5fd;
  background: #eff6ff;
}
.notice-header {
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.notice-box.warning .notice-header {
  color: #b45309;
}
.notice-box.info .notice-header {
  color: var(--primary-color);
}
.notice-body {
  font-size: 12px;
  color: var(--text-color);
  line-height: 1.6;
  margin: 0;
}
</style>
<div class="notice-box info">
  <div class="notice-header">
    <span>💡 实施提示与约束条件</span>
  </div>
  <p class="notice-body">系统部署前需确保目标服务器已开通对应网段白名单，生产数据库备份策略应保持至少保留 30 天历史快照。</p>
</div>
<div class="notice-box warning">
  <div class="notice-header">
    <span>⚠️ 风险控制与应急方案</span>
  </div>
  <p class="notice-body">版本升级期间建议安排在业务低峰期（凌晨 00:00 - 04:00）进行，若割接超时 45 分钟未完成，需立即启动一键回滚程序。</p>
</div>
<br>