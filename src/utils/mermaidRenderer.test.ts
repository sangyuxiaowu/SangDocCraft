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
    expect(drawImage).toHaveBeenCalledWith(expect.any(LoadedImage), 240, 0, 640, 1280);

    const oversized = await renderMermaidPng('flowchart TD\nA --> B', { width: 1200, height: 900 });
    expect(oversized.width).toBe(560);
    expect(oversized.height).toBe(640);
    expect(drawImage).toHaveBeenLastCalledWith(expect.any(LoadedImage), 240, 0, 640, 1280);
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('identifies mermaid fence language strings correctly', async () => {
    const { isMermaidLang } = await loadRenderer();
    expect(isMermaidLang('mermaid')).toBe(true);
    expect(isMermaidLang('mermaid {theme=dark}')).toBe(true);
    expect(isMermaidLang('mermaid{w=500}')).toBe(true);
    expect(isMermaidLang('MERMAID {align=center}')).toBe(true);
    expect(isMermaidLang('javascript')).toBe(false);
    expect(isMermaidLang('mermaid_not')).toBe(false);
    expect(isMermaidLang('')).toBe(false);
    expect(isMermaidLang(undefined)).toBe(false);
  });

  it('parses single-diagram fence attributes accurately', async () => {
    const { parseMermaidFenceOptions } = await loadRenderer();
    expect(parseMermaidFenceOptions('mermaid {theme=dark w=500 h=300 align=center}')).toEqual({
      theme: 'dark',
      width: '500',
      height: '300',
      align: 'center',
    });
    expect(parseMermaidFenceOptions('mermaid {theme="forest", w="80%", align=\'right\'}')).toEqual({
      theme: 'forest',
      width: '80%',
      align: 'right',
    });
    expect(parseMermaidFenceOptions('mermaid {theme=custom w=600px}')).toEqual({
      theme: 'custom',
      width: '600px',
    });
    expect(parseMermaidFenceOptions('mermaid')).toEqual({});
    expect(parseMermaidFenceOptions('python')).toBeNull();
  });

  it('resolves explicit mermaid themes and falls back to theme config or neutral', async () => {
    const { resolveMermaidTheme, getMermaidConfig } = await loadRenderer();
    expect(resolveMermaidTheme('dark', 'forest')).toBe('dark');
    expect(resolveMermaidTheme('custom', 'neutral')).toBe('custom');
    expect(resolveMermaidTheme(undefined, 'forest')).toBe('forest');
    expect(resolveMermaidTheme(undefined, 'custom')).toBe('custom');
    expect(resolveMermaidTheme(undefined, undefined)).toBe('neutral');

    // Test getMermaidConfig
    expect(getMermaidConfig(null).theme).toBe('neutral');
    expect(getMermaidConfig({ mermaid: { theme: 'forest' } }).theme).toBe('forest');
    expect(getMermaidConfig({ mermaid: { theme: 'custom', customColors: { primaryColor: '#123456' } as any } }).customColors.primaryColor).toBe('#123456');
  });

  it('injects init directive with theme and customColors and preserves YAML frontmatter', async () => {
    const { injectMermaidThemeDirective } = await loadRenderer();
    expect(injectMermaidThemeDirective('flowchart LR\nA --> B', 'neutral')).toBe('flowchart LR\nA --> B');
    expect(injectMermaidThemeDirective('flowchart LR\nA --> B', 'dark')).toContain('%%{init: {"theme": "dark"}}%%');
    expect(injectMermaidThemeDirective('flowchart LR\nA --> B', 'custom', { primaryColor: '#abcdef' })).toContain('"theme": "base"');
    expect(injectMermaidThemeDirective('flowchart LR\nA --> B', 'custom', { primaryColor: '#abcdef' })).toContain('"primaryColor":"#abcdef"');

    const frontmatterSource = '---\ntitle: Overview\n---\nflowchart LR\nA --> B';
    const result = injectMermaidThemeDirective(frontmatterSource, 'forest');
    expect(result.startsWith('---\ntitle: Overview\n---')).toBe(true);
    expect(result).toContain('%%{init: {"theme": "forest"}}%%');

    // Existing init directive should not be duplicated
    const existingDirective = '%%{init: {"theme": "base"}}%%\nflowchart LR\nA --> B';
    expect(injectMermaidThemeDirective(existingDirective, 'dark')).toBe(existingDirective);
    expect(injectMermaidThemeDirective(existingDirective, 'custom', { primaryColor: '#abcdef' })).toBe(existingDirective);
  });

  it('applies data-width, data-height, and theme when rendering elements', async () => {
    render.mockResolvedValue({
      svg: '<svg viewBox="0 0 300 120"></svg>',
    });
    const { renderMermaidElements } = await loadRenderer();
    document.body.innerHTML = '<div class="mermaid" data-theme="dark" data-width="480" data-height="240">flowchart LR\nA --> B</div>';

    await renderMermaidElements(document.body);

    const element = document.querySelector<HTMLElement>('.mermaid')!;
    expect(element.dataset.mermaidRendered).toBe('true');
    const svgEl = element.querySelector('svg');
    expect(svgEl).not.toBeNull();
    expect(svgEl?.style.maxWidth).toBe('');
    expect(svgEl?.style.maxHeight).toBe('240px');
    expect(render).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('%%{init: {"theme": "dark"}}%%'));
  });
});