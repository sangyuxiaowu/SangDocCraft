// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { DocumentAsset } from '../types';
import { ImagePicker } from './ImagePicker';

const asset: DocumentAsset = {
  id: 'test-image',
  fileName: 'diagram.png',
  description: 'Diagram',
  mediaType: 'image/png',
  byteLength: 1024,
  sha256: 'test',
  scope: 'document',
  data: new Uint8Array(),
};

afterEach(() => {
  document.body.innerHTML = '';
});

it('passes image alignment to insertion and resets it when reopened', () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onSelect = vi.fn();
  const render = (isOpen: boolean) => root.render(
    <ImagePicker isOpen={isOpen} assets={[asset]} isDark={false} showDimensions onClose={vi.fn()} onSelect={onSelect} />,
  );

  try {
    act(() => render(true));
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="右对齐"]')!.click());
    act(() => container.querySelector<HTMLElement>('.group.relative.cursor-pointer')!.click());
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('插入图片'))!.click());
    expect(onSelect).toHaveBeenCalledWith('@images/test-image', asset, { width: undefined, height: undefined, align: 'right' });

    act(() => render(false));
    act(() => render(true));
    expect(container.querySelector('button[aria-label="默认"]')?.getAttribute('aria-pressed')).toBe('true');
  } finally {
    act(() => root.unmount());
  }
});