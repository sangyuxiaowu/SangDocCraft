// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HtmlTemplateManager } from './HtmlTemplateManager';
import { loadHtmlTemplates, saveHtmlTemplates } from '../utils/htmlTemplateStore';
import { modal } from '../utils/modalDialog';
import type { DocumentColors } from '../utils/documentColors';

let root: Root;
let container: HTMLDivElement;

function button(label: string) {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
}

async function click(target: HTMLElement) { await act(async () => target.click()); }

function input(label: string, value: string) {
  const element = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function render(documentStyle?: DocumentColors) {
  const onClose = vi.fn();
  const onInsert = vi.fn();
  act(() => root.render(<HtmlTemplateManager isDark={false} documentStyle={documentStyle} onClose={onClose} onInsert={onInsert} />));
  return { onClose, onInsert };
}

describe('HTML template manager', () => {
  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div'); document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks();
  });

  it('previews read-only builtins in a script-disabled iframe and inserts a section', async () => {
    const { onInsert } = render();
    expect(button('保存模板').disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[aria-label="模板标题"]')!.readOnly).toBe(true);
    const frame = container.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(frame.srcdoc).toContain('data-sdc-scope');
    expect(frame.srcdoc).toContain("default-src 'none'");
    await click(Array.from(container.querySelectorAll('button')).find(element => element.textContent?.includes('插入模板'))!);
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('<section data-sdc-html>'));
  });

  it('injects document colors into the template iframe and updates them with the theme', () => {
    const style = { primaryColor: '#112233', accentColor: '#445566', textColor: '#778899', imageConfig: { borderColor: '#aabbcc' } };
    render(style);
    const source = container.querySelector('iframe')!.srcdoc;
    expect(source).toContain('--primary-color:#112233;');
    expect(source).toContain('--accent-color:#445566;');
    expect(source).toContain('--text-color:#778899;');
    expect(source).toContain('--img-border-color:#aabbcc;');
    render({ ...style, primaryColor: '#123456', imageConfig: undefined });
    expect(container.querySelector('iframe')!.srcdoc).toContain('--primary-color:#123456;');
    expect(container.querySelector('iframe')!.srcdoc).toContain('--img-border-color:#cbd5e1;');
  });

  it('aligns preview and color panel headers without width switching controls', () => {
    render();
    const previewHeader = Array.from(container.querySelectorAll('span')).find(element => element.textContent === 'A4 交付文档渲染预览')!.parentElement!.parentElement!;
    const colorHeader = Array.from(container.querySelectorAll('span')).find(element => element.textContent === '本次插入色彩调整')!.parentElement!.parentElement!;
    for (const header of [previewHeader, colorHeader]) {
      expect(header.classList.contains('h-11')).toBe(true);
      expect(header.classList.contains('border-slate-200')).toBe(true);
    }
    expect(container.querySelector('[title="自适应宽度"]')).toBeNull();
    expect(container.textContent).not.toContain('A4 宽度 (700px)');
  });

  it('unchecks concrete colors when the default palette is selected', async () => {
    const { onInsert } = render();
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false);
    await click(Array.from(container.querySelectorAll('button')).find(element => element.textContent?.includes('深蓝商务'))!);
    expect(checkbox.checked).toBe(true);
    await click(Array.from(container.querySelectorAll('button')).find(element => element.textContent?.includes('继承全局'))!);
    expect(checkbox.checked).toBe(false);
    await click(Array.from(container.querySelectorAll('button')).find(element => element.textContent?.includes('插入模板'))!);
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('var(--accent-color)'));
  });

  it('creates, saves, edits and deletes a user template', async () => {
    render();
    await click(button('新增模板'));
    input('模板标题', 'User template'); input('模板说明', 'Custom note');
    await click(button('保存模板'));
    expect(loadHtmlTemplates()[0]).toMatchObject({ title: 'User template', description: 'Custom note' });
    input('模板标题', 'Updated');
    await click(button('保存模板'));
    expect(loadHtmlTemplates()).toHaveLength(1);
    expect(loadHtmlTemplates()[0].title).toBe('Updated');
    vi.spyOn(modal, 'confirm').mockResolvedValue(true);
    await click(button('删除模板'));
    expect(loadHtmlTemplates()).toEqual([]);
  });

  it('copies a builtin without changing it and protects unsaved drafts on close', async () => {
    const { onClose } = render();
    await click(button('复制为自定义模板'));
    expect(button('保存模板').disabled).toBe(false);
    const confirm = vi.spyOn(modal, 'confirm').mockResolvedValue(false);
    await click(button('关闭 HTML 模板管理'));
    expect(confirm).toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    await click(button('保存模板'));
    expect(loadHtmlTemplates()[0].id).not.toBe('builtin-project');
    await click(button('关闭 HTML 模板管理'));
    expect(onClose).toHaveBeenCalled();
  });

  it('cleans dangerous user HTML and outside styles in the preview', async () => {
    saveHtmlTemplates([{ id: 'unsafe', title: 'Unsafe fixture', description: '', css: 'p{color:red;animation:spin 1s}', html: '<script>alert(1)</script><p onclick="alert(1)">safe</p>' }]);
    render();
    await click(Array.from(container.querySelectorAll('button')).find(element => element.textContent?.includes('Unsafe fixture'))!);
    const preview = container.querySelector('iframe')!.srcdoc;
    expect(preview).not.toMatch(/<script|onclick|animation:/);
    expect(preview).toContain('safe');
  });
});