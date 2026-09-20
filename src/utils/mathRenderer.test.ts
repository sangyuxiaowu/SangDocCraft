// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import {
  containsMath,
  ensureMathLoaded,
  getMathRanges,
  isMathReady,
  onMathReady,
  registerMathExtensions,
  renderMathHtml,
} from './mathRenderer';

describe('mathRenderer', () => {
  it('renders a pending fallback before MathJax is loaded', () => {
    expect(isMathReady()).toBe(false);
    const html = renderMathHtml('E = mc^2', false);
    expect(html).toContain('math-pending');
    expect(html).toContain('$E = mc^2$');
    expect(html).not.toContain('<svg');
  });

  it('renders self-contained SVG after MathJax loads', async () => {
    const ready = onMathReady(() => {});
    await ensureMathLoaded();
    expect(isMathReady()).toBe(true);
    ready();

    const inline = renderMathHtml('E = mc^2', false);
    expect(inline).toContain('<mjx-container');
    expect(inline).toContain('<svg');
    expect(inline).toContain('</span>');

    const display = renderMathHtml('\\frac{a}{b}', true);
    expect(display).toContain('class="math-block"');
    expect(display).toContain('display="true"');
    expect(renderMathHtml('\\frac{a}{b}', true)).toBe(display);
  });

  it('falls back to the LaTeX source when the formula is invalid', async () => {
    await ensureMathLoaded();
    const html = renderMathHtml('\\frac{1}{', true);
    expect(html).toContain('math-error');
    expect(html).toContain('\\frac{1}{');
  });

  it('detects formulas without flagging currency amounts', () => {
    expect(containsMath('给定查询 $q$ 与文档库 $D = \\{d_1, d_2\\}$。')).toBe(true);
    expect(containsMath('$$\nE = mc^2\n$$')).toBe(true);
    expect(containsMath('\\begin{align}a &= b\\end{align}')).toBe(true);
    expect(containsMath('价格是 $5 和 $10 的差别')).toBe(false);
    expect(containsMath('普通文字，没有任何公式')).toBe(false);
  });

  it('reports formula ranges for pagination splits', () => {
    expect(getMathRanges('前 $a+b$ 后 $c$')).toEqual([
      { start: 2, end: 7 },
      { start: 10, end: 13 },
    ]);
    expect(getMathRanges('没有公式')).toEqual([]);
  });

  it('registers marked extensions for inline and block formulas', async () => {
    await ensureMathLoaded();
    registerMathExtensions();
    registerMathExtensions();

    const inlineHtml = marked.parse('给定查询 $q$ 与文档库 $D = \\{d_1, d_2\\}$，公式 $\\dots$。') as string;
    expect(inlineHtml).toContain('<mjx-container');
    expect(inlineHtml).not.toContain('\\{d_1');

    const blockHtml = marked.parse('$$\nE = mc^2\n$$') as string;
    expect(blockHtml).toContain('class="math-block"');

    const bracketHtml = marked.parse('\\[a^2 + b^2 = c^2\\]') as string;
    expect(bracketHtml).toContain('class="math-block"');

    const environmentHtml = marked.parse('\\begin{align}\nE &= mc^2\n\\end{align}') as string;
    expect(environmentHtml).toContain('class="math-block"');

    const currencyHtml = marked.parse('价格是 $5 和 $10 的差别') as string;
    expect(currencyHtml).not.toContain('<mjx-container');
  });
});
