---
id: builtin-tables
title: "任务表格组件"
description: "用于展示任务进度和状态的表格组件。"
order: 16
---
<style>
.tbl-wrap{border:1px solid var(--border-color);border-radius:8px;overflow:hidden}
table.data{width:100%;border-collapse:collapse;table-layout:fixed;margin:0}
table.data th,table.data td{padding:7px 10px;text-align:left;font-size:12px;border-bottom:1px solid var(--border-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
table.data thead th{
  background:var(--primary-color);color:#fff;font-weight:600;font-size:11.5px;letter-spacing:.3px;
}
table.data tbody tr:nth-child(even){background:var(--tint-2)}
table.data tbody tr:last-child td{border-bottom:none}
.status{display:inline-block;padding:1px 8px;border-radius:20px;font-size:10.5px;font-weight:600}
.status.ok{background:#e2f3ee;color:#0b6e5f}
.status.warn{background:#fdeee9;color:#b03a2e}
.status.info{background:#e7eef8;color:#1d4f8f}  
</style>
<div class="tbl-wrap">
        <table class="data">
          <colgroup><col style="width:22%"><col style="width:14%"><col style="width:14%"><col style="width:18%"><col style="width:16%"><col style="width:16%"></colgroup>
          <thead><tr><th>任务名称</th><th>负责人</th><th>计划完成</th><th>所属模块</th><th>进度</th><th>状态</th></tr></thead>
          <tbody>
            <tr><td>门禁系统联调</td><td>李娜</td><td>2026-10-05</td><td>安防模块</td><td>90%</td><td><span class="status ok">进行中</span></td></tr>
            <tr><td>数据中台迁移</td><td>王强</td><td>2026-10-12</td><td>数据模块</td><td>55%</td><td><span class="status info">排期中</span></td></tr>
            <tr><td>大屏可视化上线</td><td>赵敏</td><td>2026-10-18</td><td>展示模块</td><td>100%</td><td><span class="status ok">已完成</span></td></tr>
            <tr><td>能耗报表重构</td><td>孙磊</td><td>2026-10-20</td><td>运维模块</td><td>30%</td><td><span class="status warn">有风险</span></td></tr>
          </tbody>
        </table>
      </div>
<br>