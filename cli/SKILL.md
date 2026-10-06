---
name: sdc-authoring
description: '制作带封面、目录、页眉页码、图表题注、A4 分页的印刷级正式文档，并导出为 Word DOCX、可打印的 HTML，或 SangDocCraft 的 .sdc。当用户需要把 Markdown 或素材整理成能打印、能交给甲方/客户/评审的正式版本时使用：标书与投标文件、可行性研究报告、立项/结项/验收报告、白皮书、产品手册、图书专著、论文、年报财报、合同协议、汇报材料、正式简历、会议纪要。典型说法：「做成 Word」「导出 DOCX」「排版成能打印的版本」「做成 PDF」「加封面和目录」「给甲方一版正式的」「导出 .sdc」「用 SangDocCraft 编辑」。若只需要一份 Markdown 草稿或做简单文本改写，不要用这个技能。Also use it to convert between Markdown, HTML, DOCX and SangDocCraft .sdc.'
homepage: https://github.com/sangyuxiaowu/SangDocCraft/
version: 1.1.0
author: sangyuxiaowu
metadata:
  openclaw:
    emoji: "📝"
    requires:
      bins: ["node"]
---

# SDC 文档编写与导出

把 Markdown 整理成带封面、目录、页眉页码、图表题注与 A4 分页的正式交付文档，并导出为 Word DOCX、HTML（可在浏览器打印为 PDF），或可在 SangDocCraft 中继续编辑的 `.sdc`。

## 何时使用 / 何时不用

| 用户诉求 | 判断 |
| --- | --- |
| 交付给甲方、客户或评审的正式文档（标书、报告、白皮书、论文等） | 使用本技能 |
| 要 Word 版、要能打印、要封面/目录/页码/题注 | 使用本技能 |
| 读写 `.sdc`、用 SangDocCraft APP 继续编辑 | 使用本技能 |
| 只要一份 Markdown 草稿，或做润色、改写、摘要 | 不使用 |
| 在线平台里协作编辑 | 不使用，走对应在线文档技能 |

## 随附文件

| 文件 | 用途 |
| --- | --- |
| `scripts/sdc.cjs` | 随附的 Node 文档转换脚本。 |
| `references/document.md` | SangDocCraft APP 使用的系统指南正文样例，展示章节、题注、图片、分页等写法。它是产品功能示例，不是通用报告模板，编写新文档时不要照搬其事实或文案。 |
| `references/meta.json` | 系统指南的元数据样例，含封面标题、副标题、作者、日期等。 |
| `references/theme.json` | 系统指南的完整主题样例，展示封面、目录、页眉页脚、正文与图表配置。 |

## 快速上手：用户原话 → 该执行的命令

| 用户说 | 做法 |
| --- | --- |
| 「做成 Word」「导出 DOCX」 | `node scripts/sdc.cjs ./paper -o ./paper.docx` |
| 「排版成能打印的版本」「做成 PDF」 | 先 `-o ./paper.html`，再用浏览器打开打印并保存为 PDF |
| 「给甲方一版正式的」「加封面和目录」 | 建 `meta.json`（封面信息）与 `theme.json`（排版），再 `-o ./paper.docx` |
| 「导出 .sdc」「用 APP 继续编辑」 | `node scripts/sdc.cjs ./paper -o ./paper.sdc` |
| 「把这个 .sdc 转成 Word/HTML」 | `node scripts/sdc.cjs ./old.sdc -o ./old.docx` |

## 工作流程

1. 确认主题、读者、用途、语言、事实依据及可用图片；缺少关键事实时询问或明确标注待补充，不编造内容。先确定交付格式：DOCX 用于 Word 编辑，HTML/PDF 用于阅读和打印，`.sdc` 用于在 APP 中继续编辑或交换。
2. 创建工作文件夹，写入 `document.md`。如使用封面，标题来自 `meta.json` 的非空 `title` 或 `--title`，正文从实际章节开始使用一级标题，不重复写文档标题。仅在关闭封面或独立短文档确有需要时，才在正文开头使用一级标题。章节不要手写序号；需要编号时设置 `theme.json` 的 `toc.headingNumbering`。表格、代码围栏、链接、公式和 Mermaid 使用 Markdown 编写。
3. 标题是必填信息；只有标题时用 `--title`，还需副标题、作者、机构、日期等信息时创建 `meta.json`，可参照 `references/meta.json` 填写真实值。仅需更改默认排版时创建 `theme.json`，可参考 `references/theme.json` 的字段，但通常只写覆盖项，例如 `{"style":{"fontSize":16},"toc":{"show":false}}`；不要把样例中的机构、版本或封面条目直接带入新文档。
4. `theme.json` 中的配置会影响文档的排版和样式，你可以根据需要修改，详细说明参见 `references/theme.md`。
5. 本地图片放在 `images/`，用 `![说明](images/chart.png)` 引用；文件名含空格时用 `![说明](<images/chart 1.png>)`。单独输入 `.md` 时可用 `--images` 指定图片目录，按该目录相对路径引用。封面、页眉和水印的图片路径也相对于图片目录解析。HTTP(S) 图片会尝试收集，失败时保留 URL；需要离线交付时改用本地图片。不要自行构造 `@images/` ID。
6. 输出后缀决定格式：`.sdc` 无需浏览器，`.html` 和 `.docx` 需要 Chrome/Edge 或 `SDC_CHROME_PATH`。输入现有 `.sdc` 时可导出 HTML 或 DOCX；单独输入 `.md` 时按需添加 `--meta`、`--theme`、`--images`，没有 meta 标题就传 `--title`。
7. 确认输出文件存在并检查内容、封面、目录、分页与图片；报错先修正文档或路径，不忽略缺失的本地图片。需要 PDF 时，先导出 HTML，检查无误后在浏览器打印并保存为 PDF。DOCX/HTML 交付保留可编辑的源文件；仅在需要 APP 继续编辑或交换文档时额外生成 `.sdc`。

## 特有语法与特殊排版注意事项

1. 强制分页机制：
   - 使用 `<!-- pagebreak -->`（独占一行）触发强制 A4 页面换页。

2. 规范表格题注：
   - 在 Markdown 表格前紧邻的上一行添加 `<!-- caption: 题注说明文本 -->`，系统会自动按照工程交付规范渲染表格标题序号与居中标注。

3. 图片引用与尺寸后缀：
  - 支持标准图片语法，并支持自定义宽高与图片对齐属性后缀，例如：`![系统架构图](@images/xxx){w=520 align=right}` 或 `![界面流程](url){w=640 h=360}`；align 可选 left、center、right，题注对齐仍由主题设置决定。
  - 文档内图片引用格式为 `@images/<id>`，永久库图片格式为 `@library/<id>`。

4. 流程图与架构图（Mermaid）：
  - 使用 ```mermaid 围栏创建图表；普通围栏继承当前文档默认 Mermaid 主题（默认 neutral）。
  - 在围栏语言之后，同时支持4个可选参数，例如 ```mermaid {theme=dark w=80% h=320 align=center}；theme 可选 neutral、default、dark、forest、base、custom，单图主题可覆盖文档默认主题；w/width 支持像素或百分比，h/height 支持像素或 auto；align 可选 left、center、right。
  - 数值高度会预留 A4 分页空间；图表在 HTML 中以 SVG 渲染，Word 导出为等比缩放的 PNG。
  - 支持图题注，方法是在围栏前添加 `<!-- caption: 题注文本 -->` 注释。

## 命令示例

以下命令从本 `SKILL.md` 所在目录运行；从其他目录运行时，请为脚本和输入文件使用相应路径。

```sh
# 用随附的 APP 系统指南样例检查 HTML 导出
node scripts/sdc.cjs ./references -o ./guide.html

# 使用自己的文件夹（含 document.md；可选 meta.json、theme.json、images/）
node scripts/sdc.cjs ./paper --title "文档标题" -o ./paper.sdc
node scripts/sdc.cjs ./paper --title "文档标题" -o ./paper.html
node scripts/sdc.cjs ./paper --title "文档标题" -o ./paper.docx

# 使用独立 Markdown 与按需指定的配置
node scripts/sdc.cjs ./draft.md --meta ./meta.json --theme ./theme.json --images ./assets -o ./draft.docx

# 将已有 .sdc 导出为 HTML 或 Word
node scripts/sdc.cjs ./old.sdc -o ./old.html
node scripts/sdc.cjs ./old.sdc -o ./old.docx
```

## 注意事项

- 随附脚本已负责默认配置、图片收集、打包和渲染：不要手动制作 ZIP，也不要要求作者编写清单、设置、历史记录、聊天记录或图片哈希。
- 脚本不会直接输出 PDF：先导出 HTML，确认无误后再用浏览器打印为 PDF。
- HTML 与 DOCX 导出依赖浏览器（Chrome/Edge），找不到时设置 `SDC_CHROME_PATH` 指向 Chromium 可执行文件；仅导出 `.sdc` 时不需要浏览器。
- SDC 文件需要安装 [SangDocCraft APP](https://github.com/sangyuxiaowu/SangDocCraft/releases) 才能打开和编辑，也可以使用[在线版本](https://sangyuxiaowu.github.io/SangDocCraft)进行查看和编辑。
