import type { DocumentTheme, MermaidConfig, MermaidCustomColors, MermaidThemeChoice, StyleConfig } from '../types';

export interface MermaidFenceOptions {
  theme?: string;
  width?: string;
  height?: string;
  align?: 'left' | 'center' | 'right';
}

export const DEFAULT_MERMAID_CUSTOM_COLORS: MermaidCustomColors = {
  primaryColor: '#2563eb',
  primaryTextColor: '#ffffff',
  primaryBorderColor: '#1d4ed8',
  lineColor: '#64748b',
  secondaryColor: '#f1f5f9',
  tertiaryColor: '#e2e8f0',
  background: '#ffffff',
};

export const DEFAULT_MERMAID_CONFIG: MermaidConfig = {
  theme: 'neutral',
  customColors: DEFAULT_MERMAID_CUSTOM_COLORS,
};

export function getMermaidConfig(
  themeOrConfig?: DocumentTheme | StyleConfig | MermaidConfig | { mermaid?: MermaidConfig } | null
): MermaidConfig {
  if (!themeOrConfig) {
    return {
      theme: 'neutral',
      customColors: { ...DEFAULT_MERMAID_CUSTOM_COLORS },
    };
  }
  if ('mermaid' in themeOrConfig && themeOrConfig.mermaid) {
    return getMermaidConfig(themeOrConfig.mermaid);
  }
  if ('cover' in themeOrConfig && 'style' in themeOrConfig) {
    const docTheme = themeOrConfig as DocumentTheme;
    const mermaid = docTheme.mermaid || docTheme.style?.mermaid;
    return getMermaidConfig(mermaid);
  }
  if ('primaryColor' in themeOrConfig && 'fontSize' in themeOrConfig) {
    const style = themeOrConfig as StyleConfig;
    return getMermaidConfig(style.mermaid);
  }
  const config = themeOrConfig as MermaidConfig;
  return {
    theme: config.theme || 'neutral',
    customColors: {
      ...DEFAULT_MERMAID_CUSTOM_COLORS,
      ...(config.customColors || {}),
    },
  };
}

export function isMermaidLang(lang?: string): boolean {
  return /^\s*mermaid(?:\b|\{|\s|$)/i.test(lang || '');
}

export function parseMermaidFenceOptions(lang?: string): MermaidFenceOptions | null {
  if (!lang || !isMermaidLang(lang)) return null;
  const match = lang.match(/\{([^}]+)\}/);
  const options: MermaidFenceOptions = {};
  if (match) {
    const attrRegex = /([a-zA-Z_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,;{}]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(match[1])) !== null) {
      const key = m[1].toLowerCase();
      const val = (m[2] ?? m[3] ?? m[4] ?? '').trim();
      if (key === 'theme') options.theme = val.toLowerCase();
      else if (key === 'w' || key === 'width') options.width = val;
      else if (key === 'h' || key === 'height') options.height = val;
      else if (key === 'align') {
        const align = val.toLowerCase();
        if (align === 'left' || align === 'center' || align === 'right') options.align = align;
      }
    }
  }
  return options;
}

export function resolveMermaidTheme(
  themeOption?: string,
  documentMermaidTheme?: string
): MermaidThemeChoice {
  const opt = (themeOption || '').trim().toLowerCase();
  if (opt === 'custom') return 'custom';
  if (opt === 'dark' || opt === 'forest' || opt === 'default' || opt === 'base' || opt === 'neutral') {
    return opt;
  }
  if (documentMermaidTheme) {
    const doc = documentMermaidTheme.trim().toLowerCase();
    if (doc === 'custom') return 'custom';
    if (doc === 'dark' || doc === 'forest' || doc === 'default' || doc === 'base' || doc === 'neutral') {
      return doc;
    }
  }
  return 'neutral';
}

export function injectMermaidThemeDirective(
  source: string,
  theme?: string,
  customColors?: Partial<MermaidCustomColors>
): string {
  const resolved = theme || 'neutral';
  if (resolved === 'neutral' && !customColors) {
    return source;
  }
  if (resolved === 'custom') {
    if (/%%\{init:\s*\{.*theme/i.test(source)) return source;
    const colors: Record<string, string> = {
      primaryColor: customColors?.primaryColor || DEFAULT_MERMAID_CUSTOM_COLORS.primaryColor,
      primaryTextColor: customColors?.primaryTextColor || DEFAULT_MERMAID_CUSTOM_COLORS.primaryTextColor,
      primaryBorderColor: customColors?.primaryBorderColor || DEFAULT_MERMAID_CUSTOM_COLORS.primaryBorderColor,
      lineColor: customColors?.lineColor || DEFAULT_MERMAID_CUSTOM_COLORS.lineColor,
      secondaryColor: customColors?.secondaryColor || DEFAULT_MERMAID_CUSTOM_COLORS.secondaryColor || '#f1f5f9',
      tertiaryColor: customColors?.tertiaryColor || DEFAULT_MERMAID_CUSTOM_COLORS.tertiaryColor || '#e2e8f0',
      background: customColors?.background || DEFAULT_MERMAID_CUSTOM_COLORS.background || '#ffffff',
    };
    const directive = `%%{init: {"theme": "base", "themeVariables": ${JSON.stringify(colors)}}}%%\n`;
    const trimmed = source.trimStart();
    const frontmatterMatch = trimmed.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    if (frontmatterMatch) {
      return frontmatterMatch[0] + directive + trimmed.slice(frontmatterMatch[0].length);
    }
    return `${directive}${source}`;
  }

  if (/%%\{init:\s*\{.*theme/i.test(source)) return source;
  const trimmed = source.trimStart();
  const frontmatterMatch = trimmed.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  const directive = `%%{init: {"theme": "${resolved}"}}%%\n`;
  if (frontmatterMatch) {
    return frontmatterMatch[0] + directive + trimmed.slice(frontmatterMatch[0].length);
  }
  return `${directive}${source}`;
}

let initialized = false;
let renderCounter = 0;
let mermaidPromise: Promise<typeof import('mermaid').default> | undefined;

async function getMermaid(): Promise<typeof import('mermaid').default> {
  mermaidPromise ??= import('mermaid').then((module) => module.default);
  const mermaid = await mermaidPromise;
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      htmlLabels: false,
    });
    initialized = true;
  }
  return mermaid;
}

export async function renderMermaidSvg(
  source: string,
  options?: { theme?: string; customColors?: Partial<MermaidCustomColors> }
): Promise<string> {
  const mermaid = await getMermaid();
  renderCounter += 1;
  const renderId = `sangdoccraft-mermaid-${renderCounter}`;
  let svg: string;
  const themedSource = injectMermaidThemeDirective(source, options?.theme, options?.customColors);
  try {
    ({ svg } = await mermaid.render(renderId, themedSource));
  } finally {
    document.getElementById(`d${renderId}`)?.remove();
  }
  if (/\baria-roledescription=(['"])error\1/i.test(svg)) {
    throw new Error('Mermaid diagram syntax error');
  }
  return svg;
}

export async function renderMermaidElements(
  root: ParentNode,
  onRendered?: (source: string, height: number) => void,
): Promise<void> {
  const elements = Array.from(root.querySelectorAll<HTMLElement>('.mermaid'));
  for (const element of elements) {
    const rawSource = element.dataset.mermaidRawSource || element.textContent || '';
    const source = rawSource.trim();
    if (!source) continue;
    element.dataset.mermaidRawSource = source;

    const theme = element.dataset.theme || 'neutral';
    const customColorsStr = element.dataset.mermaidCustomColors || '';
    const widthStr = element.dataset.width || '';
    const heightStr = element.dataset.height || '';
    const renderKey = `${source}::${theme}::${customColorsStr}::${widthStr}::${heightStr}`;

    if (element.dataset.mermaidKey === renderKey && (element.dataset.mermaidRendered === 'true' || element.dataset.mermaidRendered === 'pending')) {
      continue;
    }

    element.dataset.mermaidRendered = 'pending';
    element.dataset.mermaidKey = renderKey;
    try {
      let customColors: MermaidCustomColors | undefined;
      if (customColorsStr) {
        try {
          customColors = JSON.parse(customColorsStr);
        } catch {}
      }
      const svg = await renderMermaidSvg(source, { theme, customColors });
      if (!element.isConnected) continue;
      element.innerHTML = svg;
      const svgEl = element.querySelector('svg');
      if (svgEl) {
        if (element.dataset.height && element.dataset.height !== 'auto') {
          const h = /^\d+$/.test(element.dataset.height) ? `${element.dataset.height}px` : element.dataset.height;
          svgEl.style.maxHeight = h;
        }
      }
      element.dataset.mermaidRendered = 'true';
      onRendered?.(source, element.offsetHeight);
    } catch (error) {
      console.warn('Mermaid preview rendering failed:', error);
      if (!element.isConnected) continue;
      element.classList.add('mermaid-error');
      element.dataset.mermaidRendered = 'error';
      element.textContent = `Mermaid 图表语法错误\n${source}`;
    }
  }
}

export async function renderMermaidInHtml(html: string): Promise<string> {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  await renderMermaidElements(parsed);
  return `<!DOCTYPE html>\n${parsed.documentElement.outerHTML}`;
}

function getSvgDimensions(svg: string): { width: number; height: number } {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const viewBox = parsed.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] };
  }
  return {
    width: Number.parseFloat(parsed.getAttribute('width') || '') || 800,
    height: Number.parseFloat(parsed.getAttribute('height') || '') || 450,
  };
}

export async function renderMermaidPng(
  source: string,
  options?: { theme?: string; customColors?: Partial<MermaidCustomColors>; width?: number; height?: number }
): Promise<{ data: Uint8Array; width: number; height: number }> {
  const theme = options?.theme;
  const customColors = options?.customColors;
  const svg = await renderMermaidSvg(source, { theme, customColors });
  const dimensions = getSvgDimensions(svg);
  let documentWidth = Math.min(560, options?.width ?? Math.max(240, dimensions.width));
  let documentHeight = Math.min(640, options?.height ?? Math.max(120, (documentWidth * dimensions.height) / dimensions.width));
  if (options?.width !== undefined && options?.height === undefined) {
    documentHeight = Math.min(640, Math.max(80, (documentWidth * dimensions.height) / dimensions.width));
  } else if (options?.height !== undefined && options?.width === undefined) {
    documentWidth = Math.min(560, Math.max(120, (documentHeight * dimensions.width) / dimensions.height));
  }
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(documentWidth * scale);
  canvas.height = Math.ceil(documentHeight * scale);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.fillStyle = theme === 'dark'
    ? '#0f172a'
    : (theme === 'custom' && customColors?.background
      ? customColors.background
      : '#ffffff');
  context.fillRect(0, 0, canvas.width, canvas.height);

  const imageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to rasterize Mermaid SVG'));
      image.src = imageUrl;
    });
    const fit = Math.min(canvas.width / dimensions.width, canvas.height / dimensions.height);
    const imageWidth = dimensions.width * fit;
    const imageHeight = dimensions.height * fit;
    context.drawImage(image, (canvas.width - imageWidth) / 2, (canvas.height - imageHeight) / 2, imageWidth, imageHeight);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to create Mermaid PNG')), 'image/png');
  });

  return {
    data: new Uint8Array(await blob.arrayBuffer()),
    width: documentWidth,
    height: documentHeight,
  };
}