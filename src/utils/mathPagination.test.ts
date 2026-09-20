// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PRESET_THEMES } from '../data/presetThemes';
import { paginateContentByDom } from './markdownParser';
import { ensureMathLoaded, getMathRanges, registerMathExtensions } from './mathRenderer';

const theme = PRESET_THEMES[0];

describe('LaTeX 公式分页', () => {
  it('段落分页不会把行内公式拆到两页', async () => {
    await ensureMathLoaded();
    registerMathExtensions();

    // 模拟真实测量：公式渲染为 SVG 后不贡献文本长度，因此朴素按文本长度的切点会落在公式内部
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return (this.textContent || '').length * 20;
    });

    try {
      const formula = '$S(q, d) = \\alpha \\cdot S_{dense}(q, d)$';
      const source = `${'前置说明文字'.repeat(8)}${formula}${'后续补充说明文字'.repeat(8)}`;
      const pages = paginateContentByDom(source, { style: theme.style });

      expect(pages.length).toBeGreaterThan(1);
      // 公式完整保留在某一页中
      expect(pages.some((page) => page.includes('S_{dense}'))).toBe(true);
      // 每页的 `$` 定界符都成对出现（没有把公式拦腰截断）
      pages.forEach((page) => {
        expect((page.match(/\$/g) || []).length % 2).toBe(0);
        expect(getMathRanges(page).some((range) => range.end > page.length)).toBe(false);
      });
    } finally {
      height.mockRestore();
    }
  });

  it('块级公式整体留在同一页', async () => {
    await ensureMathLoaded();
    registerMathExtensions();

    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const mathBlocks = this.querySelectorAll('.math-block').length;
      return (this.textContent || '').length * 20 + mathBlocks * 900;
    });

    try {
      const source = `正文说明\n\n$$\nE = mc^2\n$$\n\n后续正文`;
      const pages = paginateContentByDom(source, { style: theme.style });
      const mathPages = pages.filter((page) => page.includes('E = mc^2'));
      expect(mathPages).toHaveLength(1);
      expect(mathPages[0]).toContain('$$');
    } finally {
      height.mockRestore();
    }
  });
});
