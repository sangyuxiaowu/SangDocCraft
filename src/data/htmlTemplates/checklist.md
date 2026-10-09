---
id: builtin-checklist
title: "交付验收清单表格"
description: "交付成果验收与核对清单，含标准与结论。"
order: 24
---
<style>
.acceptance-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.acceptance-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
  margin: 0;
}
.acceptance-table th {
  background: #f8fafc;
  color: var(--text-color);
  font-weight: 600;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}
.acceptance-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-color);
}
.acceptance-table tr:last-child td {
  border-bottom: none;
}
.status-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}
.status-tag.pass {
  background: #dcfce7;
  color: #15803d;
}
.status-tag.pending {
  background: #fef9c3;
  color: #a16207;
}
</style>
<div class="acceptance-table-wrap">
  <table class="acceptance-table">
    <thead>
      <tr>
        <th style="width: 25%;">交付项名称</th>
        <th style="width: 40%;">验收基准与要求</th>
        <th style="width: 20%;">责任人</th>
        <th style="width: 15%; text-align: center;">核验结果</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>系统源码及构建物</strong></td>
        <td>Git 仓库完整提交，包含自动化构建脚本与完整单元测试用例</td>
        <td>技术研发组</td>
        <td style="text-align: center;"><span class="status-tag pass">已达标</span></td>
      </tr>
      <tr>
        <td><strong>用户操作手册</strong></td>
        <td>覆盖所有业务角色核心操作步骤，图文完整，格式规范</td>
        <td>产品交付组</td>
        <td style="text-align: center;"><span class="status-tag pass">已达标</span></td>
      </tr>
      <tr>
        <td><strong>压力与安全测试报告</strong></td>
        <td>系统并发 1000 QPS 下响应时间 &lt; 200ms，无高危安全漏洞</td>
        <td>质量保证组</td>
        <td style="text-align: center;"><span class="status-tag pending">复核中</span></td>
      </tr>
    </tbody>
  </table>
</div>
<br>