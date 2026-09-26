# SangDocCraft 文档格式

## 文件标识

- 扩展名：`.sdc`
- MIME：`application/vnd.sangdoccraft.document+zip`
- 容器：ZIP
- 当前格式版本：`2`

## 包结构

```text
manifest.json      文档 ID、标题、时间与格式版本
document.md        Markdown 正文
meta.json          文档标题、作者、机构、日期、编号与版本等业务元数据
theme.json         当前文档视觉主题，不包含文档业务元数据
images.json        图片名称、描述、类型、大小、SHA-256 与作用域
settings.json      文档级设置
history.json       可选编辑历史，保存正文、文档元数据与主题快照
chats.json         可选 AI 对话记录
images/            按内容哈希 ID 存放的图片二进制
```

图片 ID 由 SHA-256 摘要生成。同一内容只保存一份二进制；描述和文件名不参与去重。

## Mermaid 图表

`document.md` 原样保存 Mermaid 围栏及其单图属性，例如：

````markdown
```mermaid {theme=custom w=80% h=320 align=center}
flowchart LR
	A --> B
```
````

`theme.json` 的可选 `mermaid` 字段保存文档级默认主题（`theme`）和自定义配色（`customColors`）。旧文档没有该字段时默认采用 `neutral`；单图声明的 `theme` 优先于文档默认主题，`custom` 使用当前文档保存的配色。具体属性与导出行为见 [Mermaid 图表指南](mermaid-guide.md)。

## 内部引用

- `@images/<id>`：当前文档图片，切换或新建文档时从 IndexedDB 清理。
- `@library/<id>`：永久图片库，不随文档切换清理。

Markdown 使用标准图片语法，例如：

```markdown
![系统架构](@images/img-0123456789abcdef01234567)
![系统架构](@images/img-0123456789abcdef01234567){w=640 h=360 align=right}
```

封面 Logo 与页眉 Logo 直接保存内部引用。保存自定义主题时，主题使用的文档图片会提升到永久库，并改写为 `@library/<id>`。

## 网络图片收集

“收集文档网络图片”扫描以下位置：

- Markdown 图片语法中的 HTTP/HTTPS 图片；
- 封面 Logo；
- 页眉 Logo。

收集后下载图片、按内容去重、写入当前文档图片库，并将原 URL 改写为 `@images/<id>`。Markdown 普通链接不会改写。

## 保存与历史

- Web 端内容变化 1.5 秒后写入 IndexedDB 恢复草稿，`Ctrl+S` 也只保存草稿，不触发下载。
- Web 端仅在用户从“导出文档”选择下载 `.sdc` 时生成文件。
- Tauri 端首次 `Ctrl+S` 显示文件对话框；已有文件路径时防抖保存 `.sdc`。
- 开启编辑历史后，达到设置的无修改时间生成快照；手动保存也生成快照。
- 历史保存 Markdown、文档元数据和主题，不复制图片数据；相同内容不会重复记录，最多保留 50 条。
- 新建或打开其他文档会清理当前文档临时图片和恢复草稿，永久图片库不受影响。
