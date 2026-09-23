// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonThemeModal } from './JsonThemeModal';
import { PRESET_THEMES } from '../data/presetThemes';
import type { DocumentTheme } from '../types';

describe('JsonThemeModal', () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (container) {
      container.remove();
      container = null;
    }
  });

  const builtinTheme = PRESET_THEMES[0];
  const customTheme: DocumentTheme = {
    ...builtinTheme,
    id: 'my-custom-theme',
    name: '我的自定义主题',
    description: '这是自定义主题的描述',
  };

  it('renders theme id, name, and description in input fields as readonly for built-in themes', () => {
    container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <JsonThemeModal
          isOpen={true}
          onClose={vi.fn()}
          currentTheme={builtinTheme}
          builtinThemes={[builtinTheme]}
          customThemes={[]}
          onApplyTheme={vi.fn()}
          onSaveTheme={vi.fn()}
          onDeleteTheme={vi.fn()}
          isDark={false}
        />
      );
    });

    const idInput = container.querySelector('#theme-id-input') as HTMLInputElement;
    const nameInput = container.querySelector('#theme-name-input') as HTMLInputElement;
    const descInput = container.querySelector('#theme-description-input') as HTMLInputElement;
    const codeTextarea = container.querySelector('#theme-code-textarea') as HTMLTextAreaElement;

    expect(idInput).not.toBeNull();
    expect(nameInput).not.toBeNull();
    expect(descInput).not.toBeNull();
    expect(codeTextarea).not.toBeNull();

    // 检查字段值
    expect(idInput.value).toBe(builtinTheme.id);
    expect(nameInput.value).toBe(builtinTheme.name);
    expect(descInput.value).toBe(builtinTheme.description);

    // 内置主题必须只读
    expect(idInput.readOnly).toBe(true);
    expect(nameInput.readOnly).toBe(true);
    expect(descInput.readOnly).toBe(true);
    expect(codeTextarea.readOnly).toBe(true);

    // 默认展示“封面”小 JSON 模块，不包含 id, name, description，仅包含封面配置
    const parsedCover = JSON.parse(codeTextarea.value);
    expect(parsedCover.id).toBeUndefined();
    expect(parsedCover.name).toBeUndefined();
    expect(parsedCover.description).toBeUndefined();
    expect(parsedCover.showCover).toBeDefined();

    // 切换到“页眉” Tab
    const headerTab = container.querySelector('#tab-header') as HTMLButtonElement;
    expect(headerTab).not.toBeNull();
    act(() => {
      headerTab.click();
    });

    const parsedHeader = JSON.parse(codeTextarea.value);
    expect(parsedHeader.show).toBeDefined();
    expect(parsedHeader.lineStyle).toBeDefined();
    expect(parsedHeader.id).toBeUndefined();

    const mermaidTab = container.querySelector('#tab-mermaid') as HTMLButtonElement;
    act(() => {
      mermaidTab.click();
    });
    expect(JSON.parse(codeTextarea.value)).toEqual(builtinTheme.mermaid);

    // 切换到“全部配置” Tab
    const allTab = container.querySelector('#tab-all') as HTMLButtonElement;
    expect(allTab).not.toBeNull();
    act(() => {
      allTab.click();
    });

    const parsedAll = JSON.parse(codeTextarea.value);
    expect(parsedAll.cover).toBeDefined();
    expect(parsedAll.header).toBeDefined();
    expect(parsedAll.style).toBeDefined();
    expect(parsedAll.mermaid).toEqual(builtinTheme.mermaid);
    expect(parsedAll.id).toBeUndefined();
  });

  it('allows editing id, name, description and code for custom themes or new draft', () => {
    container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    const onSaveTheme = vi.fn();
    const onApplyTheme = vi.fn();

    act(() => {
      root.render(
        <JsonThemeModal
          isOpen={true}
          onClose={vi.fn()}
          currentTheme={customTheme}
          builtinThemes={[builtinTheme]}
          customThemes={[customTheme]}
          onApplyTheme={onApplyTheme}
          onSaveTheme={onSaveTheme}
          onDeleteTheme={vi.fn()}
          isDark={true}
        />
      );
    });

    const idInput = container.querySelector('#theme-id-input') as HTMLInputElement;
    const nameInput = container.querySelector('#theme-name-input') as HTMLInputElement;
    const descInput = container.querySelector('#theme-description-input') as HTMLInputElement;
    const codeTextarea = container.querySelector('#theme-code-textarea') as HTMLTextAreaElement;

    expect(idInput.value).toBe(customTheme.id);
    expect(nameInput.value).toBe(customTheme.name);
    expect(descInput.value).toBe(customTheme.description);

    // 自定义主题可编辑
    expect(idInput.readOnly).toBe(false);
    expect(nameInput.readOnly).toBe(false);
    expect(descInput.readOnly).toBe(false);
    expect(codeTextarea.readOnly).toBe(false);

    // 下方代码框中同样不包含 id, name, description
    const parsedCode = JSON.parse(codeTextarea.value);
    expect(parsedCode.id).toBeUndefined();
    expect(parsedCode.name).toBeUndefined();
    expect(parsedCode.description).toBeUndefined();

    // 修改输入框内容并保存
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeSetter?.call(nameInput, '更新后的自定义名称');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('保存并应用')
    );
    expect(saveButton).toBeDefined();

    act(() => {
      saveButton?.click();
    });

    expect(onSaveTheme).toHaveBeenCalledTimes(1);
    const savedTheme = onSaveTheme.mock.calls[0][0];
    expect(savedTheme.id).toBe(customTheme.id);
    expect(savedTheme.name).toBe('更新后的自定义名称');
    expect(savedTheme.description).toBe(customTheme.description);
    expect(savedTheme.cover).toBeDefined();
    expect(onApplyTheme).toHaveBeenCalledTimes(1);
  });

  it('saves changes made in the separate Mermaid JSON tab', () => {
    container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onSaveTheme = vi.fn();

    act(() => {
      root.render(
        <JsonThemeModal
          isOpen={true}
          onClose={vi.fn()}
          currentTheme={customTheme}
          builtinThemes={[builtinTheme]}
          customThemes={[customTheme]}
          onApplyTheme={vi.fn()}
          onSaveTheme={onSaveTheme}
          onDeleteTheme={vi.fn()}
        />
      );
    });

    act(() => {
      (container!.querySelector('#tab-mermaid') as HTMLButtonElement).click();
    });
    const codeTextarea = container.querySelector('#theme-code-textarea') as HTMLTextAreaElement;
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeSetter?.call(codeTextarea, JSON.stringify({ ...customTheme.mermaid, theme: 'forest' }));
      codeTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('保存并应用'));
    act(() => {
      saveButton?.click();
    });

    expect(onSaveTheme).toHaveBeenCalledOnce();
    expect(onSaveTheme.mock.calls[0][0].mermaid.theme).toBe('forest');
    expect(onSaveTheme.mock.calls[0][0].style).toEqual(customTheme.style);
  });
});
