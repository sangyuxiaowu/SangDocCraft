---
id: builtin-signature
title: "签字确认"
description: "交付文档的签字与日期栏。"
order: 30
---
<style>
.signatures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  padding: 24px 0;
}

h4 {
  margin: 0 0 20px;
  color: var(--primary-color);
}

p {
  margin: 12px 0;
  color: var(--text-color);
}

.line {
  display: inline-block;
  width: 140px;
  border-bottom: 1px solid var(--border-color, #555);
}
</style>
<div class="signatures">
  <div><h4>甲方确认</h4><p>签字：<span class="line">&nbsp;</span></p><p>日期：<span class="line">&nbsp;</span></p></div>
  <div><h4>乙方确认</h4><p>签字：<span class="line">&nbsp;</span></p><p>日期：<span class="line">&nbsp;</span></p></div>
</div>
<br>