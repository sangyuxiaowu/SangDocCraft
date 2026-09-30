# SDC CLI

将文件夹、Markdown 或现有 `.sdc` 导出为 HTML 或 DOCX；也可将文件夹或 Markdown 打包成 `.sdc`。本包只读复用上级项目的文档格式和导出模块，不修改上级项目。

要求 Node.js 20+。HTML 和 DOCX 导出需要本机 Chrome 或 Edge（或设置 `SDC_CHROME_PATH`）；生成 `.sdc` 不需要浏览器。

```sh
npm install
npm run build
node dist/scripts/sdc-html.cjs --help
npm test
```

## 输入

文件夹约定：

```text
paper/
	document.md           # 必填
	meta.json              # 可选，文档标题、作者等
	theme.json             # 可选，只写需要覆盖的主题字段
	images/                # 可选，本地图片
```

也可直接指定 `.md` 文件。`--meta`、`--theme`、`--images` 分别指定可选的 JSON 文件和图片目录；文件夹模式会自动读取同目录的 `meta.json`、`theme.json` 和 `images/`，命令行选项优先。没有包含非空 `title` 的 `meta.json` 时，必须传 `--title "文档标题"`；`--title` 也可覆盖 meta 中的标题。Markdown 中使用 `![图](images/chart.png)` 或 `![图](<images/chart 1.png>)`，指定 `--images` 后可使用 `![图](chart.png)`。封面 `cover.logoUrl`、页眉 `header.logoUrl`、图片水印 `style.watermark.imageUrl` 也支持相对于图片目录的本地路径。本地图片会收集进 `.sdc`，或内嵌进 HTML；HTTP(S) 图片在组装文档时按 URL 各尝试收集一次，成功则内嵌，失败则警告并原样保留 URL。

缺省主题保存在 [default-theme.json](default-theme.json)，以“极简现代白皮书”为基础，可直接调整并重新运行 `npm run build`。`theme.json` 只需填写覆盖项，例如 `{"style":{"fontSize":16}}`。缺失的主题字段来自 CLI 默认主题；除标题外，缺失的文档元数据使用空字符串。生成 `.sdc` 时还会填入文档 ID、时间、设置，以及空历史和聊天记录。

## 导出

输出格式由 `-o` 后缀决定；省略 `-o` 时，在输入旁生成同名 `.html`。

```sh
node dist/scripts/sdc-html.cjs ./paper --title "白皮书" -o ./paper.html
node dist/scripts/sdc-html.cjs ./paper --title "白皮书" -o ./paper.docx
node dist/scripts/sdc-html.cjs ./paper --title "白皮书" -o ./paper.sdc
node dist/scripts/sdc-html.cjs ./draft.md --meta ./meta.json --theme ./theme.json --images ./assets -o ./draft.sdc
node dist/scripts/sdc-html.cjs ./draft.md --title "文档标题" --images ./assets -o ./draft.html
node dist/scripts/sdc-html.cjs ./old.sdc -o ./old.html
node dist/scripts/sdc-html.cjs ./old.sdc -o ./old.docx
```

HTML 生成阶段复用现有浏览器渲染器完成公式、Mermaid 和 A4 分页；输出 HTML 中的 JS 只处理窄屏布局。未收集成功的 URL 在 HTML 渲染阶段仍可能由浏览器再次请求；需要完全离线时请使用本地图片。