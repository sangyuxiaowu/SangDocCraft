---
id: builtin-process
title: "业务实施流程"
description: "标准分步流程指引，清晰交代递进步骤与核心行动。"
order: 25
---
<style>
.step-flow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.step-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
  position: relative;
}
.step-num {
  font-size: 11px;
  font-weight: 800;
  color: var(--primary-color);
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.step-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-color);
  margin-bottom: 6px;
}
.step-detail {
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}
</style>
<div class="step-flow">
  <div class="step-card">
    <div class="step-num">STEP 01</div>
    <div class="step-title">准备与立项</div>
    <p class="step-detail">确认项目范围与资源配置，完成开发环境与权限准备。</p>
  </div>
  <div class="step-card">
    <div class="step-num">STEP 02</div>
    <div class="step-title">开发与联调</div>
    <p class="step-detail">按迭代周期推进功能落地，定期执行自动化集成冒烟。</p>
  </div>
  <div class="step-card">
    <div class="step-num">STEP 03</div>
    <div class="step-title">验收与试运行</div>
    <p class="step-detail">业务方组织全流程核验，记录并修复反馈的偶发缺陷。</p>
  </div>
  <div class="step-card">
    <div class="step-num">STEP 04</div>
    <div class="step-title">交付与运维</div>
    <p class="step-detail">签署终验交接单，进入日常保障与持续监控阶段。</p>
  </div>
</div>
<br>