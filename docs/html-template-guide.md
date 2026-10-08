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

## 文档颜色变量

模板预览、A4 正文预览、分页测量和 HTML/PDF 导出统一注入当前文档配色：

| CSS 变量 | 对应配置 |
| --- | --- |
| `--primary-color` | 主色调 |
| `--accent-color` | 辅色调 |
| `--text-color` | 正文文字颜色 |
| `--img-border-color` | 图片边框颜色，未配置时为 `#cbd5e1` |

```css
.title { color: var(--primary-color); }
.note { border-left: 3px solid var(--accent-color); }
p { color: var(--text-color); }
img { border: 1px solid var(--img-border-color); }
```

更换文档主题或调整对应颜色时，预览同步更新；导出使用导出时的配色。

## 安全与打印

预览、分页测量和 HTML/PDF 使用同一套过滤与样式隔离规则。禁止脚本、事件处理属性、危险链接、iframe、嵌入对象、表单与 SVG 动画；移除 CSS 动画、过渡、`@keyframes`、`@import`、`@font-face`、CSS 网络资源及危险表达式。固定、绝对和粘性定位及 `z-index` 不保留。模板预览额外使用禁用脚本的 sandbox iframe。

模板管理中 CSS 字段只填写 CSS，HTML 字段只填写 section 内部的内容，不需要外包 `section` 或 `style` 标签。原始模板可保存和导出，危险内容在实际渲染时过滤，不会执行。

HTML 模板中的标题不参与 Markdown 章节编号和目录。Word 导出沿用现有规则，不转换任意 HTML/CSS 布局；需要保留模板精确版式时使用 HTML 或打印 PDF。

## 维护内置模板

每个内置模板是 `src/data/htmlTemplates/` 中的一个 `.md` 文件，YML 头、CSS 和 HTML 放在一起：

```text
src/data/htmlTemplates/
  project.md
  metrics.md
  signature.md
```

新增模板只需添加一个 `.md` 文件，不必修改存储逻辑或登记列表。支持嵌套目录，可按用途分组；目录层级仅用于源码组织，不改变管理窗口的分类。

格式示例：

```html
---
id: builtin-project
title: "项目说明"
description: "标题与正文组成的项目说明块。"
order: 10
---
<style>
.title { color: #c62828; }
</style>
<h3 class="title">项目说明</h3>
<p>正文内容</p>
```

YML 头仅支持 `id`、`title`、`description`、`order` 四个单行字段，允许无引号、双引号（JSON 字符串转义）或单引号（用两个单引号转义），也允许空行和整行 `#` 注释。不支持嵌套、数组、多行值或行尾注释，不依赖第三方 YAML 库。

`id` 必须唯一且保持稳定；`order` 必须是有限数值，越小越靠前，同值时按 ID 排序。正文开头的 `<style>` 可省略，其余内容作为纯 HTML，不需要外包 `section`。Vite 自动收集这些文件，并统一换行为 LF；无效元数据、缺失 HTML 或重复 ID 会报错。