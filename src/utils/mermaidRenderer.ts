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

async function renderMermaidSvg(source: string): Promise<string> {
  const mermaid = await getMermaid();
  renderCounter += 1;
  const renderId = `sangdoccraft-mermaid-${renderCounter}`;
  let svg: string;
  try {
    ({ svg } = await mermaid.render(renderId, source));
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
  const elements = Array.from(root.querySelectorAll<HTMLElement>('.mermaid:not([data-mermaid-rendered])'));
  for (const element of elements) {
    const source = (element.textContent || '').trim();
    element.dataset.mermaidRendered = 'pending';
    try {
      const svg = await renderMermaidSvg(source);
      if (!element.isConnected) continue;
      element.innerHTML = svg;
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

export async function renderMermaidPng(source: string): Promise<{ data: Uint8Array; width: number; height: number }> {
  const svg = await renderMermaidSvg(source);
  const dimensions = getSvgDimensions(svg);
  const documentWidth = Math.min(560, Math.max(240, dimensions.width));
  const documentHeight = Math.min(640, Math.max(120, documentWidth * dimensions.height / dimensions.width));
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(documentWidth * scale);
  canvas.height = Math.ceil(documentHeight * scale);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const imageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to rasterize Mermaid SVG'));
      image.src = imageUrl;
    });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
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