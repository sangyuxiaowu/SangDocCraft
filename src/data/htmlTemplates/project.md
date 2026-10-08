---
id: builtin-project
title: "基本信息卡"
description: "字段网格布局的基本信息卡。"
order: 10
---
<style>
.field-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 18px}
.field-grid .item{border-bottom:1px dashed var(--img-border-color);padding-bottom:7px}
.field-grid .item .label{font-size:10.5px;color:var(--accent-color);letter-spacing:.5px}
.field-grid .item .value{font-size:13px;font-weight:600;color:var(--text-color);margin-top:2px}
.field-grid .item.span2{grid-column:span 2}
.field-grid .item.span3{grid-column:span 3}
</style>

  <div class="field-grid">
    <div class="item"><div class="label">项目名称</div><div class="value">智慧园区综合管理平台</div></div>
    <div class="item"><div class="label">项目经理</div><div class="value">张伟</div></div>
    <div class="item"><div class="label">联系电话</div><div class="value">138-0000-1234</div></div>
    <div class="item"><div class="label">所属部门</div><div class="value">信息技术部</div></div>
    <div class="item"><div class="label">负责区域</div><div class="value">A 区 · 1-3 号楼</div></div>
    <div class="item"><div class="label">计划工期</div><div class="value">2026.09.01 - 2026.12.31</div></div>
    <div class="item span3"><div class="label">备注说明</div><div class="value">本卡适用于人员信息、项目信息、资产登记等场景，标签-值两行结构，支持三列 / 跨列布局。</div></div>
  </div>
