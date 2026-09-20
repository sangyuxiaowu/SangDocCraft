/**
 * LaTeX 数学公式渲染（Markdown 的 `$...$` / `$$...$$` / `\(...\)` / `\[...\]`）。
 *
 * 使用 MathJax 将 TeX 转换为内联 SVG：产物不依赖任何外部字体或样式表，
 * 因此预览、独立 HTML 导出、打印 PDF 与 DOCX 图片化可以复用同一套渲染结果。
 * MathJax 体积较大，这里与 Mermaid 一样按需动态加载；未加载完成时公式回退为
 * 原始 LaTeX 文本，加载完成后由调用方触发一次重新排版（见 A4Preview）。
 */
import { marked, type TokenizerAndRendererExtension, type Tokens } from 'marked';

export interface MathToken extends Tokens.Generic {
  type: 'mathInline' | 'mathBlock';
  raw: string;
  /** LaTeX 源码（不含定界符） */
  text: string;
  display: boolean;
}

interface MathJaxDocument {
  convert(tex: string, options: { display: boolean; em: number; ex: number; containerWidth: number }): unknown;
}

let mathJaxPromise: Promise<void> | undefined;
let mathDocument: MathJaxDocument | undefined;
let mathAdaptor: { outerHTML: (node: unknown) => string } | undefined;
let mathReady = false;
const readyListeners = new Set<() => void>();
const svgCache = new Map<string, string>();
const SVG_CACHE_LIMIT = 2000;

/** MathJax 是否已完成加载（未加载完成时公式会回退为 LaTeX 源码文本） */
export function isMathReady(): boolean {
  return mathReady;
}

/** 订阅「MathJax 就绪」事件；已就绪时立即回调。返回取消订阅函数。 */
export function onMathReady(listener: () => void): () => void {
  if (mathReady) {
    listener();
    return () => {};
  }
  readyListeners.add(listener);
  return () => { readyListeners.delete(listener); };
}

/** 按需加载 MathJax（仅加载一次，失败时允许重试） */
export async function ensureMathLoaded(): Promise<void> {
  mathJaxPromise ??= loadMathJax().catch((error) => {
    mathJaxPromise = undefined;
    throw error;
  });
  return mathJaxPromise;
}

function pickNamed<T>(module: unknown, name: string): T {
  const record = module as Record<string, unknown> | undefined;
  const direct = record?.[name];
  if (direct !== undefined) return direct as T;
  const fallback = (record?.default as Record<string, unknown> | undefined)?.[name];
  if (fallback !== undefined) return fallback as T;
  throw new Error(`MathJax 模块缺少导出：${name}`);
}

async function loadMathJax(): Promise<void> {
  const [mathjaxModule, texModule, svgModule, adaptorModule, handlerModule, packagesModule] = await Promise.all([
    import('mathjax-full/js/mathjax.js'),
    import('mathjax-full/js/input/tex.js'),
    import('mathjax-full/js/output/svg.js'),
    import('mathjax-full/js/adaptors/liteAdaptor.js'),
    import('mathjax-full/js/handlers/html.js'),
    import('mathjax-full/js/input/tex/AllPackages.js'),
  ]);

  const mathjax = pickNamed<{ document: (html: string, options: unknown) => MathJaxDocument }>(mathjaxModule, 'mathjax');
  const TeX = pickNamed<new (options: unknown) => unknown>(texModule, 'TeX');
  const SVG = pickNamed<new (options: unknown) => unknown>(svgModule, 'SVG');
  const liteAdaptor = pickNamed<() => typeof mathAdaptor>(adaptorModule, 'liteAdaptor');
  const RegisterHTMLHandler = pickNamed<(adaptor: unknown) => void>(handlerModule, 'RegisterHTMLHandler');
  const AllPackages = pickNamed<string[]>(packagesModule, 'AllPackages');

  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);

  // fontCache: 'local' 让每个公式自带字形路径，导出 HTML 时无需额外资源
  const tex = new TeX({ packages: AllPackages });
  const svg = new SVG({ fontCache: 'local' });

  mathAdaptor = adaptor as { outerHTML: (node: unknown) => string };
  mathDocument = mathjax.document('', { InputJax: tex, OutputJax: svg });
  mathReady = true;
  svgCache.clear();

  const listeners = Array.from(readyListeners);
  readyListeners.clear();
  listeners.forEach((listener) => listener());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapFallback(latex: string, display: boolean, modifier: string): string {
  const delimiters = display ? `$$${latex}$$` : `$${latex}$`;
  const container = display ? 'div' : 'span';
  return `<${container} class="math-${display ? 'block' : 'inline'} ${modifier}">${escapeHtml(delimiters)}</${container}>`;
}

/**
 * 将 LaTeX 渲染为 HTML（内联 SVG）。公式语法错误或 MathJax 未就绪时回退为源码文本。
 */
export function renderMathHtml(latex: string, display: boolean): string {
  const source = (latex || '').trim();
  if (!source) return display ? '<div class="math-block"></div>' : '<span class="math-inline"></span>';
  if (!mathDocument || !mathAdaptor) return wrapFallback(source, display, 'math-pending');

  const cacheKey = `${display ? 'D' : 'I'}:${source}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return cached;

  let html: string;
  try {
    const node = mathDocument.convert(source, { display, em: 16, ex: 8, containerWidth: 1280 });
    const svg = mathAdaptor.outerHTML(node);
    // MathJax 不抛出异常，而是在 SVG 内生成 <merror> 节点
    if (svg.includes('merror')) {
      console.warn('公式语法错误:', source);
      return wrapFallback(source, display, 'math-error');
    }
    html = display ? `<div class="math-block">${svg}</div>` : `<span class="math-inline">${svg}</span>`;
  } catch (error) {
    console.warn('公式渲染失败:', source, error);
    return wrapFallback(source, display, 'math-error');
  }

  if (svgCache.size >= SVG_CACHE_LIMIT) svgCache.clear();
  svgCache.set(cacheKey, html);
  return html;
}

/**
 * 单行 `$...$` 公式，遵循 Pandoc 规则：起始 `$` 后不能紧跟空白，结尾 `$` 前不能是空白、
 * 后不能是数字或 `$`。这样 `$E=mc^2$成立` 会被识别为公式，而 `$5 和 $10` 不会。
 */
const INLINE_MATH_SPAN = /\$(?![\s$])(?:\\.|[^\\\n$])*?(?<!\s)\$(?![\d$])/;
const ENVIRONMENT_SPAN = /\\begin\{(?:equation|align|alignat|gather|multline|eqnarray|displaymath|math|split|cases|[bBpPvV]?matrix|array)\*?\}/;

/** 文档中是否存在公式（仅用于决定是否需要预加载 MathJax） */
export function containsMath(markdown: string): boolean {
  if (!markdown) return false;
  if (ENVIRONMENT_SPAN.test(markdown)) return true;
  if (/\$\$[\s\S]+?\$\$/.test(markdown)) return true;
  if (/\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/.test(markdown)) return true;
  return INLINE_MATH_SPAN.test(markdown);
}

// 与 INLINE_MATH_SPAN 保持同一套规则，用于定位文本中的公式区间
const MATH_SPAN_PATTERN = new RegExp(
  `\\$\\$[\\s\\S]*?\\$\\$|\\\\\\[[\\s\\S]*?\\\\\\]|\\\\\\([\\s\\S]*?\\\\\\)|${INLINE_MATH_SPAN.source}`,
  'g',
);

/** 扫描文本中的公式区间（用于分页时避免在公式内部断开段落） */
export function getMathRanges(text: string): Array<{ start: number; end: number }> {
  if (!text || (!text.includes('$') && !text.includes('\\(') && !text.includes('\\['))) return [];
  const ranges: Array<{ start: number; end: number }> = [];
  MATH_SPAN_PATTERN.lastIndex = 0;
  let match = MATH_SPAN_PATTERN.exec(text);
  while (match) {
    if (match[0].length > 0) ranges.push({ start: match.index, end: match.index + match[0].length });
    match = MATH_SPAN_PATTERN.exec(text);
  }
  return ranges;
}

/* ------------------------------------------------------------------ *
 * Markdown 扩展：$...$ / $$...$$ / \(...\) / \[...\] / \begin{env}
 * ------------------------------------------------------------------ */

const DISPLAY_DOLLAR = /^\$\$[ \t]*\r?\n?([\s\S]+?)\r?\n?\$\$[ \t]*(?:\r?\n+|$)/;
const DISPLAY_BRACKET = /^\\\[[ \t]*\r?\n?([\s\S]+?)\r?\n?\\\][ \t]*(?:\r?\n+|$)/;
const DISPLAY_ENVIRONMENT = /^\\begin\{([A-Za-z]+\*?)\}([\s\S]*?)\\end\{\1\}[ \t]*(?:\r?\n+|$)/;
const MATH_ENVIRONMENTS = new Set([
  'equation', 'equation*', 'align', 'align*', 'alignat', 'alignat*', 'gather', 'gather*',
  'multline', 'multline*', 'eqnarray', 'eqnarray*', 'displaymath', 'math', 'split',
  'array', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix', 'cases',
]);
const DISPLAY_INLINE_DOUBLE = /^\$\$([\s\S]+?)\$\$(?!\$)/;
const INLINE_DOLLAR = /^\$(?![\s$])((?:\\.|[^\\\n$])*?(?<!\s))\$(?![\d$])/;
const INLINE_PAREN = /^\\\(((?:\\.|[^\\\n])+?)\\\)/;
const INLINE_BRACKET = /^\\\[([\s\S]+?)\\\]/;

function matchBlockMath(src: string): { raw: string; latex: string } | null {
  if (src.startsWith('$$')) {
    const match = DISPLAY_DOLLAR.exec(src);
    return match ? { raw: match[0], latex: match[1] } : null;
  }
  if (src.startsWith('\\[')) {
    const match = DISPLAY_BRACKET.exec(src);
    return match ? { raw: match[0], latex: match[1] } : null;
  }
  if (src.startsWith('\\begin{')) {
    const match = DISPLAY_ENVIRONMENT.exec(src);
    if (match && MATH_ENVIRONMENTS.has(match[1])) {
      return { raw: match[0], latex: match[0].replace(/[ \t]*(?:\r?\n+|\s*)$/, '') };
    }
  }
  return null;
}

function matchInlineMath(src: string): { raw: string; latex: string; display: boolean } | null {
  if (src.startsWith('$$')) {
    const match = DISPLAY_INLINE_DOUBLE.exec(src);
    return match ? { raw: match[0], latex: match[1], display: true } : null;
  }
  if (src.startsWith('\\(')) {
    const match = INLINE_PAREN.exec(src);
    return match ? { raw: match[0], latex: match[1], display: false } : null;
  }
  if (src.startsWith('\\[')) {
    const match = INLINE_BRACKET.exec(src);
    return match ? { raw: match[0], latex: match[1], display: true } : null;
  }
  if (src.startsWith('$')) {
    const match = INLINE_DOLLAR.exec(src);
    return match ? { raw: match[0], latex: match[1], display: false } : null;
  }
  return null;
}

/** 构建 marked 公式扩展（块级公式独占一块，行内公式可出现在任意行内 token 中） */
export function createMathExtensions(): TokenizerAndRendererExtension[] {
  return [
    {
      name: 'mathBlock',
      level: 'block',
      tokenizer(src: string) {
        const match = matchBlockMath(src);
        if (!match || !match.latex.trim()) return undefined;
        const token: MathToken = { type: 'mathBlock', raw: match.raw, text: match.latex, display: true };
        return token;
      },
      renderer(token) {
        return renderMathHtml((token as MathToken).text, true);
      },
    },
    {
      name: 'mathInline',
      level: 'inline',
      start(src: string) {
        const index = src.search(/\$|\\\(|\\\[/);
        return index < 0 ? undefined : index;
      },
      tokenizer(src: string) {
        const match = matchInlineMath(src);
        if (!match || !match.latex.trim()) return undefined;
        const token: MathToken = { type: 'mathInline', raw: match.raw, text: match.latex, display: match.display };
        return token;
      },
      renderer(token) {
        const mathToken = token as MathToken;
        return renderMathHtml(mathToken.text, Boolean(mathToken.display));
      },
    },
  ];
}

let mathExtensionsRegistered = false;

/** 在全局 marked 实例上注册公式扩展（幂等） */
export function registerMathExtensions(): void {
  if (mathExtensionsRegistered) return;
  mathExtensionsRegistered = true;
  marked.use({ extensions: createMathExtensions() });
}

/**
 * 将公式栅格化为 PNG（供 DOCX 使用：Word 无法直接嵌入 SVG/MathML）。
 * 返回的宽高为 CSS 像素（96 DPI），位图按 `scale` 倍超采样以保证清晰度。
 */
export async function renderMathPng(
  latex: string,
  display: boolean,
  options: { fontSizePx?: number; scale?: number } = {},
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const { fontSizePx = 15, scale = 3 } = options;
  await ensureMathLoaded();

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;font-size:${fontSizePx}px;line-height:1;`;
  host.innerHTML = renderMathHtml(latex, display);
  document.body.appendChild(host);

  try {
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('MathJax 未生成 SVG');

    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));

    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.removeAttribute('style');
    const markup = new XMLSerializer().serializeToString(clone);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const imageUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to rasterize formula SVG'));
        image.src = imageUrl;
      });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(imageUrl);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to create formula PNG')), 'image/png');
    });

    return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally {
    host.remove();
  }
}
