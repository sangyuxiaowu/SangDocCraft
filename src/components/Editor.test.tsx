// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

function renderEditor(value: string) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  act(() => root.render(
    <Editor
      value={value}
      onChange={onChange}
      assets={[]}
      documentId="test-document"
      onAssetsChanged={async () => {}}
      saveStatus="saved"
      lastSavedAt={null}
    />,
  ));
  return { root, onChange, textarea: container.querySelector('textarea')! };
}

function pressTab(textarea: HTMLTextAreaElement, shiftKey = false) {
  act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  })));
}

describe('Editor keyboard indentation', () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    roots.forEach((root) => root.unmount());
    roots.length = 0;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('indents a single-line selection without replacing it', () => {
    const rendered = renderEditor('alpha beta');
    roots.push(rendered.root);
    rendered.textarea.setSelectionRange(6, 10);
    pressTab(rendered.textarea);
    expect(rendered.onChange).toHaveBeenCalledWith('  alpha beta');
  });

  it('unindents every selected line with Shift+Tab', () => {
    const rendered = renderEditor('  alpha\n  beta');
    roots.push(rendered.root);
    rendered.textarea.setSelectionRange(0, 14);
    pressTab(rendered.textarea, true);
    expect(rendered.onChange).toHaveBeenCalledWith('alpha\nbeta');
  });
});