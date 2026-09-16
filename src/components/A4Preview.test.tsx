// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RenderedMarkdownPage } from './A4Preview';

describe('RenderedMarkdownPage', () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    roots.forEach((root) => root.unmount());
    roots.length = 0;
    document.body.innerHTML = '';
  });

  it('preserves Mermaid DOM mutations when parent state rerenders with unchanged HTML', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const props = {
      html: '<div class="mermaid">flowchart LR\nA --> B</div>',
      primaryColor: '#2563eb',
      accentColor: '#0ea5e9',
      bulletChar: '•',
    };

    await act(async () => root.render(<RenderedMarkdownPage {...props} />));
    const mermaid = container.querySelector<HTMLElement>('.mermaid')!;
    mermaid.innerHTML = '<svg data-rendered="true"></svg>';

    await act(async () => root.render(<RenderedMarkdownPage {...props} />));

    expect(container.querySelector('[data-rendered="true"]')).not.toBeNull();
    expect(container.textContent).not.toContain('flowchart LR');
  });
});