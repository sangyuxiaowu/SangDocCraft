// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HtmlTemplateManager } from './HtmlTemplateManager';
import { loadHtmlTemplates, saveHtmlTemplates } from '../utils/htmlTemplateStore';
import { modal } from '../utils/modalDialog';

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

function render() {
  const onClose = vi.fn();
  const onInsert = vi.fn();
  act(() => root.render(<HtmlTemplateManager isDark={false} onClose={onClose} onInsert={onInsert} />));
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