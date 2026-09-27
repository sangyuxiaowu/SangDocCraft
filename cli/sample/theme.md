# SangDocCraft 主题配置参考

本参考说明随附文档转换工具支持的主题配置，而非从单份样例推断。`theme.json` 控制封面、目录、页眉页脚、正文、图表和水印；文档标题、作者、机构、日期等业务信息属于 `meta.json` 或命令参数 `--title`，不属于主题。

## 主题来源与加载规则

随附脚本已内置“极简现代白皮书”作为缺省主题；在文档文件夹中放 `theme.json`，或对独立 Markdown 传入 `--theme theme.json`，即可按对象层级覆盖。未写的字段保留内置默认值；数组（如 `cover.coverlist`、`toc.levelStyles`）整体替换。仅使用本 Skill 即可导出，无须额外提供默认主题文件。

SangDocCraft 应用另有九套预设主题：`enterprise-standard`、`tech-spec`、`governmental-standard`、`minimal-clean`、`creative-studio`、`enterprise-signature`、`research-report`、`business-briefing`、`academic-paper`。**随附脚本不会仅凭 `theme.json` 的 `id` 切换预设**；要使用其他预设，需提供其完整主题配置。`id`、`name`、`description` 是主题标识和展示信息，不代替排版配置。

可用封面模板 ID 为 `enterprise`、`modern`、`spec`、`minimal`、`creative`、`academic`、`signature`、`briefing`、`research`。`cover.coverStyle` 选择封面模板，与主题 `id` 不是同一字段。

## 常用配置

有封面的长文档可保留封面，按需开启自动章节编号和调整行距：

```json
{
  "toc": { "title": "目录", "headingNumbering": "decimal" },
  "style": { "fontSize": 14, "lineHeight": 1.7 }
}
```

无封面的会议纪要等短文档可以关闭封面、目录及页眉页脚：

```json
{
  "cover": { "showCover": false },
  "toc": { "show": false },
  "header": { "show": false },
  "footer": { "show": false }
}
```

有封面时，文档标题只在封面展示，不要将它重复写成正文一级标题；正文从实际章节开始。需要序号时在 `toc.headingNumbering` 中启用自动编号，不要手写 `# 1 背景`、`## 1.1 目标`。无论是否显示目录，HTML 导出都会应用该编号策略。

## 字段说明

| 字段 | 作用和常用值 |
| --- | --- |
| `id`、`name`、`description` | 主题标识及展示信息；一般沿用内置默认值，无需为每份文档重写。 |
| `cover.showCover` | 是否显示封面；无封面的会议纪要等短文档可设为 `false`。 |
| `cover.coverStyle` | 选择上文列出的已注册封面模板；不能只靠修改主题 `id` 切换封面。 |
| `cover.logoUrl`、`cover.logoHeight` | 封面图片地址及高度。图片可用图片目录内的相对路径，也可用 HTTP(S) 地址。 |
| `cover.coverlist`、`cover.coverListColumns` | 封面补充信息数组（每项有 `label` 和 `value`），以及 `1` 或 `2` 列布局；复制整套主题时核对条目是否仍适用于当前文档。 |
| `header.show`、`header.hideOnCover` | 是否显示页眉，以及是否在封面隐藏。 |
| `header.leftText`、`centerText`、`rightText` | 页眉左、中、右文字；`header.lineStyle` 可选 `solid`、`accent`、`double`、`none`。 |
| `header.logoUrl`、`logoHeight`、`logoOpacity`、`logoTopOffset`、`leftTextOffset` | 页眉 Logo 及其显示设置；只在需要时覆盖。 |
| `footer.show`、`footer.hideOnCover` | 是否显示页脚，以及是否在封面隐藏。 |
| `footer.leftText`、`centerText`、`rightText` | 页脚左、中、右文字。 |
| `footer.pageNumberFormat`、`pageNumberPosition` | 页码形式：`none`、`simple`、`page`、`pageOfTotal`、`hyphen`；位置：`left`、`center`、`right`。 |
| `toc.show`、`toc.title`、`toc.maxDepth` | 是否生成目录、目录标题和收录层级（`1` 到 `4`）。 |
| `toc.headingNumbering` | 正文标题和目录统一的自动编号：`none`、`decimal`、`chinese`、`decimal-skip-h1`（不编号一级标题）。未设置时等同 `none`；不要在 Markdown 中写死章节序号。 |
| `toc.leaderStyle`、`showPageNumbers`、`pageBreakAfter` | 目录引导线（`dots`、`dashes`、`line`、`none`）、页码与目录后分页。 |
| `toc.titleStyle`、`titleCenter`、`titleFont`、`levelStyles`、`titleOnEveryPage` | 目录标题外观（`underline`、`accent-block`、`badge`、`minimal`）、居中、标题字体、各级字体和多页目录重复标题。 |
| `style.primaryColor`、`accentColor`、`textColor` | 主色、强调色和正文颜色，使用 `#RRGGBB` 等 CSS 颜色值。 |
| `style.fontFamily`、`bodyFontFamily`、`latinFontFamily` | 字体选项：`fontFamily` 为 `sans`、`serif`、`kaiti`、`heiti`、`mono`；正文和西文字体按需覆盖。 |
| `style.fontSize`、`lineHeight`、`paragraphMarginBefore`、`paragraphMarginAfter` | 正文字号（px）、行距倍数及段前/段后间距（px）。 |
| `style.headingFonts.h1` 至 `h4` | 各级标题的 `fontFamily`、`fontSize`、`bold`、`italic`、`underline`、`marginBefore`、`marginAfter`；只覆盖需调整的层级和属性。 |
| `style.h1Style`、`h2Style`、`h1PageBreak`、`h1Center` | 一级标题外观（`underline`、`accent-block`、`badge`、`minimal`）、二级标题外观（`border-left`、`underline-subtle`、`plain`）、一级标题另起一页及居中。 |
| `style.paginationMode` | `auto` 按 A4 高度自动分页；`manual` 仅按显式分页标记（如独占一行的 `<!-- pagebreak -->`）分页。 |
| `style.indentParagraph`、`bulletStyle`、`numberStyle` | 段首缩进、无序列表标记和有序列表样式。 |
| `style.codeTheme`、`tableStyle` | 代码主题（`light`、`dark`）及表格样式（`minimal`、`striped`、`bordered`）。 |
| `style.imageConfig` | 图片的 `borderStyle`（`none`、`solid`、`subtle`、`shadow`、`card`、`rounded`）、`borderColor`、`showCaption`、`autoNumber`、`numberPrefix`、`captionAlign`。 |
| `style.tableCaptionConfig` | 表格题注的 `showCaption`、`autoNumber`、`numberPrefix`、`captionPosition`（`top`/`bottom`）、`captionAlign`。图片和表格的题注编号与章节编号分别配置。 |
| `style.watermark` | 水印：`show`、`type`（`text`/`image`）、`text`、`imageUrl`、`fontSize`、`color`、`opacity`、`rotate`、`layout`（`single`/`repeat`）、`repeatGap`、`hideOnCover`、`imageWidth`；默认关闭。 |
| `mermaid.theme`、`mermaid.customColors` | 图表主题可选 `neutral`、`default`、`dark`、`forest`、`base`、`custom`；自定义配色仅在 `theme` 为 `custom` 时使用。单图围栏中的主题声明可覆盖文档默认值。 |

## 字段结构与渲染细节

`toc.titleFont` 与 `toc.levelStyles` 使用 `fontFamily`、`fontSize`、`bold`、`italic`、`underline`、`marginBefore`、`marginAfter`；`levelStyles` 还可设置 `paddingLeft`。目录层级最多四级。目录字体在渲染时各层另有默认值，因此无需复制所有字段；若传入 `levelStyles` 数组，该数组会整体替换，导出时再逐层补齐字体默认值。

封面条目以及页眉页脚的文字可使用整个值为 `@title`、`@subtitle`、`@author`、`@department`、`@organization`、`@date`、`@number` 或 `@version` 的动态字段；页眉页脚还支持 `@h1`、`@h2`。不要把占位符嵌入其他文字中（例如 `文档：@title`），这种写法不会展开。正文标题由 Markdown 一级至四级标题控制；文档标题由元数据单独提供。

图片标题来自 Markdown 图片的说明文字，表格题注由 Markdown 内容提供；`imageConfig`、`tableCaptionConfig` 只控制显示、编号、位置和外观，不会自动生成业务描述。Mermaid 围栏可按图声明 `theme`、宽高和对齐；`mermaid.customColors` 允许设置 `primaryColor`、`primaryTextColor`、`primaryBorderColor`、`lineColor`、`secondaryColor`、`tertiaryColor`、`background`。随附脚本收集本地或可获取的 HTTP(S) 图片，主题中的 `cover.logoUrl`、`header.logoUrl` 和 `style.watermark.imageUrl` 同样可引用图片目录内的文件。

## 样例与兼容性

`references/theme.json` 用于展示系统指南的一组完整配置，它把封面设置为 `academic`，页眉页脚包含 SangDocCraft 产品文案，并选用 `decimal-skip-h1` 自动编号；这些不是所有文档的默认值。该样例还保留 `style.backgroundColor`、`style.coverBgColor`、`style.h3Style`，这些字段不会改变随附工具的 HTML 排版效果，不要依赖它们。新建文档以内置缺省主题为基线，按需要写局部覆盖；生成 HTML 或 `.sdc` 后检查封面、目录、分页、图片和打印效果。