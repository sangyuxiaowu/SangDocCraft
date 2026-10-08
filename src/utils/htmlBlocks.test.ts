// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { marked } from 'marked';
import { compileScopedCss, sanitizeDocumentHtml } from './htmlBlocks';
import { splitExplicitPages } from './pageBreaks';
import { paginateContentByDom, postProcessRenderedHtml } from './markdownParser';

describe('print HTML blocks', () => {
  it('keeps blank lines, nested sections and pagebreak comments in one raw HTML token', () => {
    const source = '<section data-sdc-html>\n<style>p {margin:0}</style>\n\n<section><p>**not markdown**</p></section>\n<!-- pagebreak -->\n</section>';
    expect(marked.lexer(source)).toHaveLength(1);
    expect(marked.lexer(source)[0].type).toBe('sdcHtml');
    expect(marked.parse(source)).toBe(source);
    expect(splitExplicitPages(source)).toEqual([source]);
  });

  it('scopes selector lists and nested conditional rules without splitting functional selectors', () => {
    const css = compileScopedCss('.title, :is(p, h3) {color:#c62828} @media print { p {margin:0} }', 'sdc-test');
    expect(css).toContain('[data-sdc-scope="sdc-test"] .title');
    expect(css).toContain('[data-sdc-scope="sdc-test"] :is(p,h3)');
    expect(css).toContain('@media print {[data-sdc-scope="sdc-test"] p');
  });

  it('removes global CSS, animation, network CSS and dangerous positioning', () => {
    const css = compileScopedCss('@import "evil.css"; @font-face {font-family:evil;src:url(evil)} @keyframes spin {to {opacity:0}} p {color:red;animation:spin 1s;transition:all 1s;background:url(https://evil);position:fixed;z-index:999}', 'sdc-test');
    expect(css).toContain('color:red');
    expect(css).not.toMatch(/import|font-face|keyframes|animation|transition|url|fixed|z-index/);
  });

  it('drops outside styles and unsafe HTML while preserving other HTML and comments', () => {
    const html = sanitizeDocumentHtml('<style>body {color:red}</style><!-- caption: Test --><div><b>safe</b></div><section data-sdc-html><style>p {color:green}</style><script>alert(1)</script><iframe src="https://evil"></iframe><p onclick="alert(1)" style="animation:spin 1s;color:red">text</p><a href="javascript:alert(1)">link</a></section>');
    expect(html).not.toMatch(/body \{|<script|<iframe|onclick|javascript:|animation:/);
    expect(html).toContain('<b>safe</b>');
    expect(html).toContain('<!-- caption: Test -->');
    expect(html).toContain('break-inside:avoid');
    expect(html).toMatch(/\[data-sdc-scope="sdc-[^"]+"\] p/);
  });

  it('assigns unique scopes even to identical blocks with supplied scopes', () => {
    const html = sanitizeDocumentHtml('<section data-sdc-html data-sdc-scope="same"><style>p {color:red}</style><p>A</p></section>'.repeat(2));
    const container = document.createElement('div');
    container.innerHTML = html;
    const scopes = Array.from(container.querySelectorAll('section'), section => section.getAttribute('data-sdc-scope'));
    expect(new Set(scopes).size).toBe(2);
    expect(scopes).not.toContain('same');
  });

  it('moves a complete block to a new page without splitting its paragraphs', () => {
    const height = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return Array.from(this.children).reduce((total, child) => total + (child.matches('section') ? 600 : 500), 0);
    });
    const section = '<section data-sdc-html>\n<style>p{margin:0}</style>\n\n<p>First</p>\n<p>Second</p>\n</section>';
    try {
      expect(paginateContentByDom(`Intro\n\n${section}\n\nAfter`)).toEqual(['Intro', section, 'After']);
    } finally { height.mockRestore(); }
  });

  it('does not rewrite images or caption comments inside pure HTML blocks', () => {
    const rendered = postProcessRenderedHtml('<section data-sdc-html><img src="https://example.test/image.png" alt="Image"><!-- caption: Keep --><p>Text</p></section>');
    expect(rendered).toContain('<img');
    expect(rendered).toContain('<!-- caption: Keep -->');
    expect(rendered).not.toContain('<figure');
  });
});