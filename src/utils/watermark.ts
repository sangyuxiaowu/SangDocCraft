import { WatermarkConfig, StyleConfig } from '../types';

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  show: false,
  type: 'text',
  text: '内部资料 请勿外传',
  fontSize: 28,
  color: '#94a3b8',
  opacity: 0.15,
  rotate: -30,
  layout: 'repeat',
  repeatGap: 140,
  hideOnCover: true,
  imageWidth: 120,
};

export const WATERMARK_TEXT_PRESETS = [
  '内部资料 请勿外传',
  '机密资料',
  '绝密文件',
  '草稿文件',
  'CONFIDENTIAL',
  'INTERNAL USE ONLY',
  'DRAFT',
  'SAMPLE',
] as const;

export const WATERMARK_COLOR_PRESETS = [
  { label: '浅灰', value: '#94a3b8' },
  { label: '深灰', value: '#475569' },
  { label: '商务蓝', value: '#2563eb' },
  { label: '警示红', value: '#dc2626' },
  { label: '安全绿', value: '#16a34a' },
  { label: '琥珀橙', value: '#d97706' },
] as const;

export function getWatermarkConfig(
  styleOrWatermark?: StyleConfig | Partial<WatermarkConfig> | { watermark?: Partial<WatermarkConfig> } | null
): WatermarkConfig {
  if (!styleOrWatermark) return { ...DEFAULT_WATERMARK_CONFIG };

  const rawConfig: Partial<WatermarkConfig> | undefined =
    'watermark' in styleOrWatermark
      ? (styleOrWatermark as { watermark?: Partial<WatermarkConfig> }).watermark
      : (styleOrWatermark as Partial<WatermarkConfig>);

  if (!rawConfig) return { ...DEFAULT_WATERMARK_CONFIG };

  return {
    show: Boolean(rawConfig.show),
    type: rawConfig.type === 'image' ? 'image' : 'text',
    text: typeof rawConfig.text === 'string' ? rawConfig.text : DEFAULT_WATERMARK_CONFIG.text,
    fontSize: typeof rawConfig.fontSize === 'number' && rawConfig.fontSize > 0 ? rawConfig.fontSize : DEFAULT_WATERMARK_CONFIG.fontSize,
    color: typeof rawConfig.color === 'string' && rawConfig.color ? rawConfig.color : DEFAULT_WATERMARK_CONFIG.color,
    opacity: typeof rawConfig.opacity === 'number' ? Math.max(0.01, Math.min(1, rawConfig.opacity)) : DEFAULT_WATERMARK_CONFIG.opacity,
    rotate: typeof rawConfig.rotate === 'number' ? rawConfig.rotate : DEFAULT_WATERMARK_CONFIG.rotate,
    layout: rawConfig.layout === 'single' ? 'single' : 'repeat',
    repeatGap: typeof rawConfig.repeatGap === 'number' && rawConfig.repeatGap > 0 ? rawConfig.repeatGap : DEFAULT_WATERMARK_CONFIG.repeatGap,
    hideOnCover: rawConfig.hideOnCover !== undefined ? Boolean(rawConfig.hideOnCover) : DEFAULT_WATERMARK_CONFIG.hideOnCover,
    imageUrl: rawConfig.imageUrl,
    imageWidth: typeof rawConfig.imageWidth === 'number' && rawConfig.imageWidth > 0 ? rawConfig.imageWidth : DEFAULT_WATERMARK_CONFIG.imageWidth,
  };
}

export function escapeSvgText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function calculateWatermarkMetrics(config: WatermarkConfig): {
  patternWidth: number;
  patternHeight: number;
} {
  const gap = config.repeatGap || 140;
  if (config.type === 'image') {
    const imgW = config.imageWidth || 120;
    return {
      patternWidth: Math.max(160, imgW + gap),
      patternHeight: Math.max(100, imgW * 0.75 + gap),
    };
  }

  const text = config.text || '';
  const estTextWidth = Math.max(80, text.length * config.fontSize * 1.05);
  return {
    patternWidth: Math.max(gap * 1.5, estTextWidth + gap),
    patternHeight: Math.max(90, config.fontSize * 2 + gap),
  };
}

const WATERMARK_IMAGE_ID = 'doc-watermark-image';

export function renderWatermarkImageDefinition(watermark: WatermarkConfig | undefined): string {
  const config = getWatermarkConfig(watermark);
  if (!config.show || config.type !== 'image' || !config.imageUrl) return '';

  const width = config.imageWidth || 120;
  return `
    <svg width="0" height="0" aria-hidden="true" focusable="false" style="position: absolute; overflow: hidden;">
      <defs>
        <image id="${WATERMARK_IMAGE_ID}" href="${escapeSvgText(config.imageUrl)}" width="${width}" height="${width * 0.7}" preserveAspectRatio="xMidYMid meet" />
      </defs>
    </svg>
  `;
}

/**
 * Generates standalone SVG / HTML overlay string for export and printing
 */
export function renderWatermarkHtml(
  watermark: WatermarkConfig | undefined,
  isCover: boolean,
  pageId: string | number,
): string {
  if (!watermark || !watermark.show) return '';
  if (isCover && watermark.hideOnCover !== false) return '';

  const config = getWatermarkConfig(watermark);
  const patternId = `wm-pattern-${pageId}`;

  if (config.layout === 'single') {
    return `
      <div class="doc-watermark-overlay" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; z-index: 1; display: flex; align-items: center; justify-content: center;">
        <div style="transform: rotate(${config.rotate}deg); transform-origin: center center; opacity: ${config.opacity}; user-select: none;">
          ${config.type === 'image' && config.imageUrl ? `
            <svg width="${(config.imageWidth || 120) * 1.8}" height="${(config.imageWidth || 120) * 1.8 * 0.7}" style="display: block; overflow: visible;"><use href="#${WATERMARK_IMAGE_ID}" transform="scale(1.8)" /></svg>
          ` : `
            <span style="color: ${config.color}; font-size: ${Math.round(config.fontSize * 1.8)}px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; font-weight: 700; letter-spacing: 4px; white-space: nowrap;">${escapeSvgText(config.text)}</span>
          `}
        </div>
      </div>
    `;
  }

  const { patternWidth, patternHeight } = calculateWatermarkMetrics(config);

  return `
    <div class="doc-watermark-overlay" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; z-index: 1;">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden;">
        <defs>
          <pattern
            id="${patternId}"
            width="${patternWidth}"
            height="${patternHeight}"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(${config.rotate})"
          >
            ${config.type === 'image' && config.imageUrl ? `
              <use
                href="#${WATERMARK_IMAGE_ID}"
                x="${(patternWidth - (config.imageWidth || 120)) / 2}"
                y="${(patternHeight - (config.imageWidth || 120) * 0.7) / 2}"
                opacity="${config.opacity}"
              />
            ` : `
              <text
                x="${patternWidth / 2}"
                y="${patternHeight / 2}"
                text-anchor="middle"
                dominant-baseline="middle"
                fill="${config.color}"
                fill-opacity="${config.opacity}"
                font-size="${config.fontSize}px"
                font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif"
                font-weight="bold"
                letter-spacing="2px"
              >${escapeSvgText(config.text)}</text>
            `}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#${patternId})" />
      </svg>
    </div>
  `;
}
