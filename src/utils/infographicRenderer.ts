import DOMPurify from 'dompurify';
import { parseImageDimensions, type ImageDimensions } from './imageDimensions';

export function isInfographicLang(lang?: string): boolean {
  return /^infographic\s*(?:\{[^{}]*\})?\s*$/i.test(lang?.trim() || '');
}

export function parseInfographicFenceOptions(lang?: string): ImageDimensions {
  if (!isInfographicLang(lang)) return {};
  return parseImageDimensions(lang?.match(/\{([^{}]*)\}/)?.[1]) ?? {};
}

let enginePromise: Promise<typeof import('@antv/infographic')> | undefined;
const svgCache = new Map<string, Promise<string>>();

export function convertInfographicText(svg: SVGSVGElement): void {
  for (const foreignObject of svg.querySelectorAll('foreignObject')) {
    const span = foreignObject.querySelector('span');
    if (!span || !span.firstChild) continue;
    const style = getComputedStyle(span);
    const fontSize = Number.parseFloat(style.fontSize) || 14;
    const inverse = foreignObject.getScreenCTM()?.inverse();
    if (!inverse) throw new Error('Unable to measure infographic text');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('fill', style.color);
    text.setAttribute('font-family', style.fontFamily);
    text.setAttribute('font-size', String(fontSize));
    text.setAttribute('font-weight', style.fontWeight);
    text.setAttribute('font-style', style.fontStyle);
    text.setAttribute('xml:space', 'preserve');
    const transform = foreignObject.getAttribute('transform');
    if (transform) text.setAttribute('transform', transform);
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    let currentLine: SVGTSpanElement | undefined;
    let previousTop = Number.NaN;
    while ((node = walker.nextNode())) {
      const content = node.textContent || '';
      for (let index = 0; index < content.length; index++) {
        if (content[index] === '\n') continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (!currentLine || Math.abs(rect.top - previousTop) > 1) {
          const point = svg.createSVGPoint();
          point.x = rect.left;
          point.y = rect.bottom;
          const position = point.matrixTransform(inverse);
          currentLine = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          currentLine.setAttribute('x', String(position.x));
          currentLine.setAttribute('y', String(position.y - fontSize * 0.2));
          text.appendChild(currentLine);
          previousTop = rect.top;
        }
        currentLine.textContent += content[index];
      }
    }
    foreignObject.replaceWith(text);
  }
}

async function getEngine() {
  enginePromise ??= Promise.all([
    import('@antv/infographic'),
    import('@iconify-json/mdi/icons.json'),
  ]).then(([engine, { default: collection }]) => {
    const icons = collection.icons as Record<string, { body: string; width?: number; height?: number }>;
    engine.registerResourceLoader(async ({ data, scene }) => {
      const name = data.replace(/^mdi[/:]/, '');
      const icon = scene !== 'illus' ? icons[name] : undefined;
      if (!icon) throw new Error(`Unknown infographic icon: ${data}`);
      const svg = engine.loadSVGResource(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width || collection.width} ${icon.height || collection.height}">${icon.body}</svg>`);
      if (!svg) throw new Error(`Invalid infographic icon: ${data}`);
      return svg as unknown as SVGSymbolElement;
    });
    return engine;
  });
  return enginePromise;
}

async function createSvg(source: string): Promise<string> {
  const { Infographic } = await getEngine();
  await document.fonts?.ready;
  const container = document.createElement('div');
  Object.assign(container.style, { position: 'fixed', left: '-10000px', top: '0', width: '900px', visibility: 'hidden' });
  document.body.appendChild(container);
  const infographic = new Infographic({
    container, width: 900, height: 540, editable: false,
    themeConfig: { base: { text: { 'font-family': 'Microsoft YaHei, sans-serif' } } },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      infographic.on('error', (error: unknown) => reject(error instanceof Error ? error : new Error(JSON.stringify(error))));
      infographic.on('loaded', () => resolve());
      timer = setTimeout(() => reject(new Error('Infographic rendering timed out')), 15000);
      infographic.render(source);
    });
    const node = container.querySelector('svg');
    if (!node) throw new Error('Infographic did not produce an SVG');
    convertInfographicText(node);
    const url = await infographic.toDataURL({ type: 'svg', embedResources: true, removeIds: true });
    const svg = await (await fetch(url)).text();
    return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['style'] });
  } finally {
    clearTimeout(timer);
    infographic.destroy();
    container.remove();
  }
}

export function renderInfographicSvg(source: string): Promise<string> {
  const key = source.trim();
  let result = svgCache.get(key);
  if (!result) {
    result = createSvg(key).catch((error: unknown) => {
      svgCache.delete(key);
      throw error;
    });
    if (svgCache.size >= 32) svgCache.delete(svgCache.keys().next().value!);
    svgCache.set(key, result);
  }
  return result;
}

export async function renderInfographicElements(
  root: ParentNode,
  onRendered?: (source: string, height: number) => void,
): Promise<void> {
  for (const element of root.querySelectorAll<HTMLElement>('.infographic')) {
    if (element.dataset.infographicRendered) continue;
    const source = (element.dataset.infographicSource || element.textContent || '').trim();
    if (!source) continue;
    element.dataset.infographicSource = source;
    element.dataset.infographicRendered = 'pending';
    try {
      const svg = await renderInfographicSvg(source);
      if (root instanceof Element && !root.contains(element)) continue;
      element.innerHTML = svg;
      const node = element.querySelector('svg');
      if (node) {
        node.style.maxWidth = '100%';
        node.style.width = element.dataset.width || !element.dataset.height ? '100%' : 'auto';
        node.style.height = element.dataset.height ? `${element.dataset.height}px` : 'auto';
        if (element.dataset.height) node.style.maxHeight = `${element.dataset.height}px`;
      }
      element.dataset.infographicRendered = 'true';
      onRendered?.(source, element.offsetHeight);
    } catch (error) {
      console.warn('Infographic rendering failed:', error);
      element.dataset.infographicRendered = 'error';
      element.classList.add('infographic-error');
      element.textContent = `Infographic 信息图渲染失败\n${source}`;
    }
  }
}

export async function renderInfographicInHtml(html: string): Promise<string> {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  await renderInfographicElements(parsed);
  return `<!DOCTYPE html>\n${parsed.documentElement.outerHTML}`;
}

export async function renderInfographicImage(source: string, options: ImageDimensions = {}): Promise<{
  svg: Uint8Array; png: Uint8Array; width: number; height: number;
}> {
  const svg = await renderInfographicSvg(source);
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const viewBox = parsed.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  const intrinsicWidth = viewBox?.[2] || Number.parseFloat(parsed.getAttribute('width') || '') || 900;
  const intrinsicHeight = viewBox?.[3] || Number.parseFloat(parsed.getAttribute('height') || '') || 540;
  const scale = Math.min(560 / intrinsicWidth, 640 / intrinsicHeight, 1);
  const width = options.width ?? (options.height ? options.height * intrinsicWidth / intrinsicHeight : intrinsicWidth * scale);
  const height = options.height ?? (options.width ? options.width * intrinsicHeight / intrinsicWidth : intrinsicHeight * scale);
  parsed.setAttribute('width', String(width));
  parsed.setAttribute('height', String(height));
  const sizedSvg = new XMLSerializer().serializeToString(parsed);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * 3);
  canvas.height = Math.ceil(height * 3);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  const url = URL.createObjectURL(new Blob([sizedSvg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to rasterize infographic'));
      image.src = url;
    });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }
  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to create infographic PNG')), 'image/png');
  });
  return { svg: new TextEncoder().encode(sizedSvg), png: new Uint8Array(await png.arrayBuffer()), width, height };
}