# HTML 模板

编辑器工具栏的「HTML 模板管理」提供内置模板与本机自定义模板库。模板包含标题、说明、CSS 和 HTML，右侧实时预览。内置模板只读，可复制为自定义模板；用户模板支持新增、修改、保存、删除、搜索以及 JSON 导入导出。模板插入到当前光标或选区前方，可撤销。

自定义模板保存在当前浏览器或桌面应用的本机存储中，不随 `.sdc` 模板库同步。插入后的 HTML 正文会随文档保存；跨设备迁移模板库请使用 JSON 导出与导入。导入追加模板，不覆盖已有条目；单文件上限 2 MB，最多包含 200 个模板。

## 正文语法

```html
<section data-sdc-html>
  <style>
    .title { color: #c62828; }
    p { margin: 0; }
  </style>

  <h3 class="title">项目说明</h3>
  <p>这里使用纯 HTML，不混写 Markdown。</p>
</section>
```

整个 section 是纯 HTML，内部空行、嵌套 section 和分页注释不会触发 Markdown 解析或拆页。自动分页时，当前页放不下就整体移到下一页。单块超过一整页可用高度时仍不拆分，需要缩小或分成多个 section，避免打印裁切。

## 样式隔离

渲染时自动分配唯一 `data-sdc-scope="sdc-..."`，不需要在源文件中手写。重复插入同一模板也会得到不同 scope。

```css
[data-sdc-scope="sdc-..."] .title { color: #c62828; }
[data-sdc-scope="sdc-..."] p { margin: 0; }
```

支持选择器列表、功能伪类、`@media` 和 `@supports` 内的普通规则。`:scope` 单独作为选择器时可设置 section 自身样式。暂不支持 CSS 嵌套规则，请写完整选择器。位于 section 外的 `<style>` 不生效；普通 section 内的样式同样会被隔离，但只有标记 `data-sdc-html` 的 section 享有纯 HTML 和整块分页规则。

## 安全与打印

预览、分页测量和 HTML/PDF 使用同一套过滤与样式隔离规则。禁止脚本、事件处理属性、危险链接、iframe、嵌入对象、表单与 SVG 动画；移除 CSS 动画、过渡、`@keyframes`、`@import`、`@font-face`、CSS 网络资源及危险表达式。固定、绝对和粘性定位及 `z-index` 不保留。模板预览额外使用禁用脚本的 sandbox iframe。

模板管理中 CSS 字段只填写 CSS，HTML 字段只填写 section 内部的内容，不需要外包 `section` 或 `style` 标签。原始模板可保存和导出，危险内容在实际渲染时过滤，不会执行。

HTML 模板中的标题不参与 Markdown 章节编号和目录。Word 导出沿用现有规则，不转换任意 HTML/CSS 布局；需要保留模板精确版式时使用 HTML 或打印 PDF。