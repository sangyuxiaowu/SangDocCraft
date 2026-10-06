# Infographic 信息图

在 Markdown 中使用 `infographic` 围栏，内容遵循 [AntV Infographic 语法](https://infographic.antv.vision/learn/infographic-syntax)。可从 [Gallery](https://infographic.antv.vision/gallery) 选择模板。

````markdown
<!-- caption: 客户增长引擎 -->

```infographic
infographic list-row-horizontal-icon-arrow
data
  title 客户增长引擎
  desc 多渠道触达与复购提升
  items
    - label 线索获取
      value 18.6
      desc 渠道投放与内容获客
      icon rocket-launch
    - label 转化提效
      value 12.4
      desc 线索评分与自动跟进
      icon progress-check
    - label 复购提升
      value 9.8
      desc 会员体系与权益运营
      icon account-sync
    - label 口碑传播
      value 6.2
      desc 社群激励与推荐裂变
      icon account-group
```
````

## 尺寸与对齐

点击 A4 预览中的信息图，可使用与图片相同的宽高输入、拖拽手柄和左 / 居中 / 右对齐按钮。修改写回代码块的首行，不修改图内数据：

````markdown
```infographic {w=400 h=240 align=right}
infographic list-row-horizontal-icon-arrow
data
  items
    - label 线索获取
      icon rocket-launch
```
````

- `w`、`h` 使用像素，规则与图片相同；只设置一个尺寸时按比例计算另一个尺寸。
- 清空高度输入可恢复自动高度；取消拖动会恢复原尺寸，不写回源码。
- `align` 支持 `left`、`center`、`right`，不改变题注的对齐设置。
- 预览、分页、HTML/PDF 和 Word 导出均读取这些属性。
- 仅支持整张图的尺寸与对齐，不提供图内节点拖动或文字编辑。

## 图标与资源

- 内置完整 MDI 图标数据，`rocket-launch`、`mdi/rocket-launch` 和 `mdi:rocket-launch` 等价，无需联网。
- 引擎及图标数据按需加载。完整图标包约 3 MB，生产 PWA 会缓存它以供离线使用。
- 其他名称可能触发引擎的联网图标搜索；远程资源仍受网络和 CORS 限制。离线文档优先使用 MDI 图标或内联资源。
- 渲染等待资源加载完成，超时或语法错误会保留源码并提示失败。

## 排版与导出

- 预览渲染后测量高度并重新分页，信息图和题注作为整体移动，不跨页拆分。
- 未指定尺寸时，图形等比适配正文宽度，最大高度为 720 px；显式指定尺寸时按 `w`、`h` 排版，预览宽度仍不超过正文范围。内容很多时宜拆成多个图形或选择更紧凑的模板。
- 题注使用正文图片的显示、自动编号和对齐设置，与图片及 Mermaid 共用编号。
- HTML 与打印 PDF 嵌入静态 SVG，不要求收件方加载 AntV 脚本；CLI 复用相同导出链路。
- Word 同时包含 SVG 原图和三倍显示尺寸的 PNG 兼容图，保持宽高比。图形文字转换为普通 SVG 文本，避免 `foreignObject` 的兼容问题。
- Word 中的信息图是图片，不是可编辑的图表或 SmartArt；修改应在 Markdown 源码中完成。
- `.sdc` 保留 Markdown 源码，重新打开后再次渲染。远程图标、插图和自定义字体不保证跨设备离线还原。
- 模板决定哪些字段可见，填写 `value` 不代表每个模板都会显示数值。