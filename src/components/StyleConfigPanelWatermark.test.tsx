// @vitest-environment jsdom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StyleConfigPanel } from './StyleConfigPanel';
import { PRESET_THEMES } from '../data/presetThemes';
import { DEFAULT_DOCUMENT_META } from '../data/defaultDocumentMeta';
import { DEFAULT_WATERMARK_CONFIG } from '../utils/watermark';

describe('StyleConfigPanel - Watermark Settings in Other Tab', () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    roots.forEach((r) => r.unmount());
    roots.length = 0;
    document.body.innerHTML = '';
  });

  it('sets an entire field from the quick selector', async () => {
    const onChange = vi.fn();
    const theme = {
      ...PRESET_THEMES[0],
      cover: { ...PRESET_THEMES[0].cover, coverlist: [{ label: '标题', value: '原有文字' }] },
      header: { ...PRESET_THEMES[0].header, show: true, leftText: '原有页眉' },
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => root.render(<StyleConfigPanel theme={theme} meta={DEFAULT_DOCUMENT_META}
      onChange={onChange} onMetaChange={() => undefined} assets={[]} uiMode="light" />));
    const coverPicker = container.querySelector<HTMLSelectElement>('select[aria-label="标题的值插入变量"]')!;
    expect(coverPicker.parentElement?.querySelector('input[aria-label="标题的值"]')?.className).toContain('pr-9');
    expect(coverPicker.className).toContain('absolute right-0');
    expect(Array.from(coverPicker.options).some((option) => option.value === 'h1')).toBe(false);
    await act(async () => {
      coverPicker.value = 'title';
      coverPicker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      cover: expect.objectContaining({ coverlist: [{ label: '标题', value: '@title' }] }),
    }));

    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === '页眉')?.click());
    const headerPicker = container.querySelector<HTMLSelectElement>('select[aria-label="页眉左侧插入变量"]')!;
    await act(async () => {
      headerPicker.value = 'h2';
      headerPicker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      header: expect.objectContaining({ leftText: '@h2' }),
    }));
  });

  it('renders watermark section under Other tab and toggles enable', async () => {
    const theme = {
      ...PRESET_THEMES[0],
      style: {
        ...PRESET_THEMES[0].style,
        watermark: {
          ...DEFAULT_WATERMARK_CONFIG,
          show: false,
        },
      },
    };
    const onChange = vi.fn();

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <StyleConfigPanel
          theme={theme}
          meta={DEFAULT_DOCUMENT_META}
          onChange={onChange}
          onMetaChange={() => undefined}
          assets={[]}
          uiMode="light"
        />
      );
    });

    // Switch to Other tab by clicking the button with '其他'
    const buttons = Array.from(container.querySelectorAll('button'));
    const otherTabBtn = buttons.find((b) => b.textContent?.includes('其他'));
    expect(otherTabBtn).toBeDefined();

    await act(async () => {
      otherTabBtn?.click();
    });

    // Watermark section should now be visible in DOM
    expect(container.textContent).toContain('文档水印');

    // Click '启用水印' button
    const enableBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('启用水印'));
    expect(enableBtn).toBeDefined();

    await act(async () => {
      enableBtn?.click();
    });

    expect(onChange).toHaveBeenCalled();
    const updatedTheme = onChange.mock.calls[0][0];
    expect(updatedTheme.style.watermark.show).toBe(true);
  });

  it('allows changing watermark text, type, layout, and presets when enabled', async () => {
    const theme = {
      ...PRESET_THEMES[0],
      style: {
        ...PRESET_THEMES[0].style,
        watermark: {
          ...DEFAULT_WATERMARK_CONFIG,
          show: true,
          text: '内部保密',
        },
      },
    };
    const onChange = vi.fn();

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <StyleConfigPanel
          theme={theme}
          meta={DEFAULT_DOCUMENT_META}
          onChange={onChange}
          onMetaChange={() => undefined}
          assets={[]}
          uiMode="dark"
        />
      );
    });

    // Switch to Other tab
    const otherTabBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('其他'));
    await act(async () => {
      otherTabBtn?.click();
    });

    // Should find text input with '内部保密'
    const textInput = container.querySelector<HTMLInputElement>('input[placeholder*="内部资料 请勿外传"]');
    expect(textInput).not.toBeNull();
    expect(textInput?.value).toBe('内部保密');

    // Change text input using React prototype value setter
    await act(async () => {
      if (textInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(textInput, '机密资料');
        textInput.dispatchEvent(new Event('input', { bubbles: true }));
        textInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.style.watermark.text).toBe('机密资料');

    // Click preset chip "绝密文件"
    const secretChip = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === '绝密文件');
    expect(secretChip).toBeDefined();

    await act(async () => {
      secretChip?.click();
    });

    const presetCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(presetCall.style.watermark.text).toBe('绝密文件');

    // Click layout button "页面居中 (单个大标)"
    const singleLayoutBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('页面居中'));
    expect(singleLayoutBtn).toBeDefined();

    await act(async () => {
      singleLayoutBtn?.click();
    });

    const layoutCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(layoutCall.style.watermark.layout).toBe('single');
  });
});
