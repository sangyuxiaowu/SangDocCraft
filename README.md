<div align="center">
	<img src="docs/assets/logo.png" alt="SangDocCraft Logo" width="112" />
	<h1>SangDocCraft</h1>
	<p>面向正式交付文档的 Markdown 编辑、A4 排版与导出工具</p>
</div>

SangDocCraft 将 Markdown 编辑、分页预览和样式配置集中在一个工作区中，适合编写技术方案、架构设计、项目报告等需要规范版式的文档。项目既可作为 Web 应用运行，也可通过 Tauri 构建为桌面应用。

## 功能特性

- **实时 A4 预览**：提供双栏预览、专注编辑和 A4 全屏三种视图，并支持拖动调整编辑区宽度。
- **自动分页排版**：根据页面尺寸处理段落、列表、表格、代码块和图片，支持手动分页符。
- **完整文档结构**：可配置封面、目录、页眉、页脚、页码和标题层级样式。
- **可视化主题配置**：调整字体、字号、配色、间距、列表、表格和代码块样式。
- **主题管理**：内置多套交付主题，支持创建、导入、导出和持久化自定义主题。
- **丰富 Markdown 内容**：支持常用 Markdown 语法、任务列表、表格、图片及 Mermaid 图表。
- **多格式导出**：导出带排版样式的 Word (`.docx`) 或单文件 HTML (`.html`)。
- **本地自动保存**：文档、当前主题、界面模式及布局偏好保存在浏览器本地存储中。
- **桌面端支持**：基于 Tauri 2 构建 Windows、macOS 和 Linux 桌面应用。

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite 6、Tailwind CSS 4 |
| Markdown | Marked、Mermaid |
| 文档导出 | docx |
| 桌面端 | Tauri 2、Rust |
| 测试 | Vitest、jsdom |

## 快速开始

### 环境要求

- Node.js 18 或更高版本
- npm 或兼容的包管理器
- 构建桌面应用时，需额外安装 [Rust](https://www.rust-lang.org/tools/install) 和对应平台的 [Tauri 系统依赖](https://v2.tauri.app/start/prerequisites/)

### Web 开发

```bash
npm install
npm run dev
```

开发服务器默认运行在 <http://localhost:3000>。

构建并预览生产版本：

```bash
npm run build
npm run preview
```

### 桌面端开发

```bash
npm install
npm run dev:tauri
```

构建桌面安装包：

```bash
npm run build:tauri
```

构建产物位于 `src-tauri/target/release/bundle/`。`prebuild:tauri` 会在构建前同步版本号，并使用 `docs/assets/logo.png` 重新生成桌面图标。

## 使用说明

1. 在左侧编辑区输入 Markdown，或从顶部的“载入范本”选择示例文档。
2. 选择双栏、专注编辑或 A4 全屏视图查看内容。
3. 从右侧面板配置封面、页眉页脚、目录、配色和正文样式。
4. 使用顶部主题菜单切换预设主题，或在“主题管理”中维护自定义主题。
5. 点击“导出文档”，生成 Word 或自包含 HTML 文件。

插入强制分页符：

```html
<!-- pagebreak -->
```

为表格添加标题：

```html
<!-- caption: 表格标题 -->
```

Mermaid 图表使用标准围栏代码块：

````markdown
```mermaid
flowchart LR
	A[Markdown] --> B[A4 预览]
	B --> C[Word / HTML]
```
````

> [!NOTE]
> 自动保存基于当前浏览器或桌面 WebView 的本地存储。清理应用数据前，请先导出重要文档。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建 Web 生产版本 |
| `npm run preview` | 本地预览 Web 构建产物 |
| `npm run lint` | 执行 TypeScript 类型检查 |
| `npm test` | 运行 Vitest 测试 |
| `npm run clean` | 清理 Web 构建产物 |
| `npm run dev:tauri` | 启动 Tauri 桌面开发模式 |
| `npm run build:tauri` | 构建桌面安装包 |
| `npm run prebuild:tauri` | 同步版本并生成桌面图标 |
| `npm run release` | 在 `main` 分支提交版本、创建标签并推送远程仓库 |

> [!WARNING]
> `release` 会执行 Git 提交及推送操作，仅应在确认版本号和工作区状态后使用。

## 项目结构

```text
SangDocCraft/
├─ src/
│  ├─ components/       # 编辑器、预览和配置面板
│  ├─ data/             # 内置 Markdown 范本与预设数据
│  ├─ themes/           # 主题注册、封面插件与主题存储
│  └─ utils/            # Markdown 排版、分页及导出逻辑
├─ src-tauri/           # Tauri 桌面端配置与 Rust 入口
├─ docs/assets/         # 文档与应用图像资源
├─ scripts/             # 版本同步和发布脚本
└─ public/              # Web 静态资源
```

## 质量检查

提交代码前建议运行：

```bash
npm run lint
npm test
npm run build
```

## 许可证

本项目基于 [Apache License 2.0](LICENSE.txt) 开源。
