// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const initialize = vi.fn();
const render = vi.fn();

vi.mock('mermaid', () => ({
  default: { initialize, render },
}));

async function loadRenderer() {
  vi.resetModules();
  return import('./mermaidRenderer');
}

describe('mermaidRenderer', () => {
  beforeEach(() => {
    initialize.mockReset();
    render.mockReset();
    document.body.innerHTML = '';
  });

  it('uses SVG labels and renders each element once', async () => {
    render.mockResolvedValue({
      svg: '<svg viewBox="0 0 300 120"><text>Rendered</text></svg>',
    });
    const { renderMermaidElements } = await loadRenderer();
    document.body.innerHTML = '<div class="mermaid">flowchart LR\nA --> B</div>';

    await renderMermaidElements(document.body);
    await renderMermaidElements(document.body);

    expect(initialize).toHaveBeenCalledOnce();
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({
      htmlLabels: false,
      securityLevel: 'strict',
      startOnLoad: false,
    }));
    expect(render).toHaveBeenCalledOnce();
    const element = document.querySelector<HTMLElement>('.mermaid');
    expect(element?.dataset.mermaidRendered).toBe('true');
    expect(element?.querySelector('svg')).not.toBeNull();
  });

  it('reports the rendered layout height for repagination', async () => {
    render.mockResolvedValue({
      svg: '<svg viewBox="0 0 300 120"><text>Rendered</text></svg>',
    });
    const { renderMermaidElements } = await loadRenderer();
    document.body.innerHTML = '<div class="mermaid">flowchart LR\nA --> B</div>';
    const element = document.querySelector<HTMLElement>('.mermaid')!;
    vi.spyOn(element, 'offsetHeight', 'get').mockReturnValue(240);
    const onRendered = vi.fn();

    await renderMermaidElements(document.body, onRendered);

    expect(onRendered).toHaveBeenCalledWith('flowchart LR\nA --> B', 240);
  });

  it('marks an element pending before awaiting Mermaid', async () => {
    let finishRender: ((value: { svg: string }) => void) | undefined;
    render.mockReturnValue(new Promise((resolve) => {
      finishRender = resolve;
    }));
    const { renderMermaidElements } = await loadRenderer();
    document.body.innerHTML = '<div class="mermaid">flowchart LR\nA --> B</div>';

    const firstRender = renderMermaidElements(document.body);
    await renderMermaidElements(document.body);

    expect(document.querySelector<HTMLElement>('.mermaid')?.dataset.mermaidRendered).toBe('pending');
    await vi.waitFor(() => expect(render).toHaveBeenCalledOnce());
    finishRender?.({ svg: '<svg viewBox="0 0 300 120"></svg>' });
    await firstRender;
    expect(document.querySelector<HTMLElement>('.mermaid')?.dataset.mermaidRendered).toBe('true');
  });

  it('keeps the source and exposes an error state for invalid syntax', async () => {
    render.mockRejectedValue(new Error('invalid diagram'));
    const { renderMermaidElements } = await loadRenderer();
    document.body.innerHTML = '<div class="mermaid">not a diagram</div>';

    await renderMermaidElements(document.body);

    const element = document.querySelector<HTMLElement>('.mermaid');
    expect(element?.dataset.mermaidRendered).toBe('error');
    expect(element?.classList.contains('mermaid-error')).toBe(true);
    expect(element?.textContent).toContain('not a diagram');
  });

  it('treats Mermaid error SVGs as invalid syntax', async () => {
    render.mockResolvedValue({
      svg: '<svg aria-roledescription="error"><text>Syntax error in text</text></svg>',
    });
    const { renderMermaidElements } = await loadRenderer();
    document.body.innerHTML = '<div class="mermaid">not a diagram</div>';

    await renderMermaidElements(document.body);

    const element = document.querySelector<HTMLElement>('.mermaid');
    expect(element?.dataset.mermaidRendered).toBe('error');
    expect(element?.querySelector('svg')).toBeNull();
    expect(element?.textContent).toContain('not a diagram');
  });

  it('removes Mermaid error artifacts left in the document body', async () => {
    const errorSvg = '<svg aria-roledescription="error"><text>Syntax error in text</text></svg>';
    render.mockImplementation(async (renderId: string) => {
      const artifact = document.createElement('div');
      artifact.id = `d${renderId}`;
      artifact.innerHTML = errorSvg;
      document.body.append(artifact);
      return { svg: errorSvg };
    });
    const { renderMermaidElements } = await loadRenderer();
    document.body.insertAdjacentHTML('afterbegin', '<div class="mermaid">not a diagram</div>');

    await renderMermaidElements(document.body);

    expect(document.querySelector('[id^="dsangdoccraft-mermaid-"]')).toBeNull();
    expect(document.querySelector('svg[aria-roledescription="error"]')).toBeNull();
  });

  it('caps a tall DOCX diagram at 560 by 640 pixels', async () => {
    render.mockResolvedValue({
      svg: '<svg viewBox="0 0 800 1600" xmlns="http://www.w3.org/2000/svg"></svg>',
    });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }));
    });
    class LoadedImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', LoadedImage);
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
    URL.revokeObjectURL = vi.fn();
    const { renderMermaidPng } = await loadRenderer();

    const result = await renderMermaidPng('flowchart TD\nA --> B');

    expect(result.width).toBe(560);
    expect(result.height).toBe(640);
    expect(drawImage).toHaveBeenCalledWith(expect.any(LoadedImage), 0, 0, 1120, 1280);
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});