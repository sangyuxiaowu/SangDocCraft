// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertInfographicText, isInfographicLang, parseInfographicFenceOptions, renderInfographicElements, renderInfographicSvg } from './infographicRenderer';

const engine = vi.hoisted(() => ({ export: vi.fn(), destroy: vi.fn(), loaded: undefined as (() => void) | undefined }));

vi.mock('@antv/infographic', () => ({
  registerResourceLoader: vi.fn(),
  loadSVGResource: vi.fn(),
  Infographic: class {
    private listeners = new Map<string, (...args: unknown[]) => void>();
    constructor(private options: { container: HTMLElement }) {}
    on(event: string, listener: (...args: unknown[]) => void) { this.listeners.set(event, listener); }
    render(source: string) {
      if (source === 'invalid') {
        this.listeners.get('error')?.(new Error('Invalid syntax'));
        return;
      }
      this.options.container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><text>Growth</text></svg>';
      engine.loaded = () => this.listeners.get('loaded')?.();
      if (source !== 'delayed') engine.loaded();
    }
    toDataURL() {
      engine.export();
      return Promise.resolve(`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><text>Growth</text><script>alert(1)</script></svg>')}`);
    }
    destroy() { engine.destroy(); }
  },
}));

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Infographic rendering', () => {
  it('recognizes only the infographic fence', () => {
    expect(isInfographicLang(' INFOGRAPHIC ')).toBe(true);
    expect(isInfographicLang('infographic-other')).toBe(false);
    expect(isInfographicLang()).toBe(false);
  });

  it('parses numeric width, height and alignment using the image rules', () => {
    expect(isInfographicLang('infographic {w=320 h=120 align=right}')).toBe(true);
    expect(parseInfographicFenceOptions('infographic {w=320 h=120 align=right}')).toEqual({ width: 320, height: 120, align: 'right' });
    expect(parseInfographicFenceOptions('infographic {w=-1 align=right}')).toEqual({});
    expect(parseInfographicFenceOptions('infographic {w=50%}')).toEqual({});
    expect(parseInfographicFenceOptions('infographic')).toEqual({});
  });

  it('waits for resource completion and cleans up the offscreen instance', async () => {
    const calls = engine.export.mock.calls.length;
    const pending = renderInfographicSvg('delayed');
    await vi.waitFor(() => expect(engine.loaded).toBeDefined());
    expect(engine.export.mock.calls.length).toBe(calls);
    engine.loaded!();
    const svg = await pending;
    expect(svg).toContain('<text>Growth</text>');
    expect(svg).not.toContain('<script');
    expect(document.body.children).toHaveLength(0);
    expect(engine.destroy).toHaveBeenCalled();
  });

  it('shares cached renders for repeated identical source', async () => {
    const calls = engine.export.mock.calls.length;
    const first = renderInfographicSvg('cached');
    const second = renderInfographicSvg('cached');
    expect(first).toBe(second);
    await first;
    expect(engine.export.mock.calls.length).toBe(calls + 1);
  });

  it('renders containers in a detached HTML export document', async () => {
    const parsed = new DOMParser().parseFromString('<div class="infographic">html-export</div>', 'text/html');
    await renderInfographicElements(parsed);
    expect(parsed.querySelector('.infographic svg text')?.textContent).toBe('Growth');
    expect(parsed.querySelector<HTMLElement>('.infographic')?.dataset.infographicRendered).toBe('true');
  });

  it('preserves failed source as text without leaking a render host', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const parsed = new DOMParser().parseFromString('<div class="infographic">invalid</div>', 'text/html');
    await renderInfographicElements(parsed);
    expect(parsed.querySelector('.infographic-error')?.textContent).toContain('invalid');
    expect(document.body.children).toHaveLength(0);
  });

  it('converts wrapped HTML text to safe SVG text without losing content', () => {
    const host = document.createElement('div');
    host.innerHTML = '<svg><foreignObject transform="translate(10 20)"><span style="font-size:14px;color:rgb(20,30,40)">ABCD</span></foreignObject></svg>';
    document.body.appendChild(host);
    const svg = host.querySelector('svg')!;
    const foreignObject = host.querySelector('foreignObject')!;
    Object.assign(foreignObject, { getScreenCTM: () => ({ inverse: () => ({}) }) });
    Object.assign(svg, { createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }) });
    vi.spyOn(document, 'createRange').mockImplementation(() => {
      let offset = 0;
      return {
        setStart: (_node: Node, index: number) => { offset = index; },
        setEnd: vi.fn(),
        getBoundingClientRect: () => ({ left: (offset % 2) * 10, top: offset < 2 ? 0 : 20, bottom: offset < 2 ? 16 : 36, width: 10, height: 16 }),
      } as unknown as Range;
    });
    convertInfographicText(svg);
    expect(svg.querySelector('foreignObject')).toBeNull();
    expect(svg.querySelector('text')?.textContent).toBe('ABCD');
    expect(svg.querySelector('text')?.getAttribute('transform')).toBe('translate(10 20)');
    expect(Array.from(svg.querySelectorAll('tspan')).map((span) => span.textContent)).toEqual(['AB', 'CD']);
  });
});