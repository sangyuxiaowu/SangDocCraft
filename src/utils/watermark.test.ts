import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WATERMARK_CONFIG,
  calculateWatermarkMetrics,
  escapeSvgText,
  getWatermarkConfig,
  renderWatermarkImageDefinition,
  renderWatermarkHtml,
} from './watermark';

describe('watermark utilities', () => {
  it('returns default config when null or empty', () => {
    const config = getWatermarkConfig(null);
    expect(config.show).toBe(false);
    expect(config.type).toBe('text');
    expect(config.text).toBe(DEFAULT_WATERMARK_CONFIG.text);
    expect(config.fontSize).toBe(28);
    expect(config.layout).toBe('repeat');
    expect(config.hideOnCover).toBe(true);
  });

  it('merges partial config correctly', () => {
    const config = getWatermarkConfig({
      watermark: {
        show: true,
        text: '机密材料',
        fontSize: 32,
        opacity: 0.25,
        rotate: -45,
        layout: 'single',
        color: '#dc2626',
        hideOnCover: false,
        repeatGap: 180,
        type: 'text',
      },
    });

    expect(config.show).toBe(true);
    expect(config.text).toBe('机密材料');
    expect(config.fontSize).toBe(32);
    expect(config.opacity).toBe(0.25);
    expect(config.rotate).toBe(-45);
    expect(config.layout).toBe('single');
    expect(config.color).toBe('#dc2626');
    expect(config.hideOnCover).toBe(false);
    expect(config.repeatGap).toBe(180);
  });

  it('escapes SVG special characters correctly', () => {
    const escaped = escapeSvgText('Confidential <Top & Secret> "Draft"');
    expect(escaped).toBe('Confidential &lt;Top &amp; Secret&gt; &quot;Draft&quot;');
  });

  it('calculates repeat pattern metrics for text and image', () => {
    const textMetrics = calculateWatermarkMetrics({
      ...DEFAULT_WATERMARK_CONFIG,
      text: '内部公开资料',
      fontSize: 24,
      repeatGap: 150,
    });
    expect(textMetrics.patternWidth).toBeGreaterThanOrEqual(150);
    expect(textMetrics.patternHeight).toBeGreaterThanOrEqual(90);

    const imgMetrics = calculateWatermarkMetrics({
      ...DEFAULT_WATERMARK_CONFIG,
      type: 'image',
      imageWidth: 160,
      repeatGap: 140,
    });
    expect(imgMetrics.patternWidth).toBe(300);
    expect(imgMetrics.patternHeight).toBe(260);
  });

  it('renders watermark HTML for repeat text watermark', () => {
    const html = renderWatermarkHtml(
      {
        ...DEFAULT_WATERMARK_CONFIG,
        show: true,
        text: '研发专案',
        color: '#2563eb',
        opacity: 0.2,
        rotate: -30,
        layout: 'repeat',
      },
      false,
      'test-1',
    );

    expect(html).toContain('doc-watermark-overlay');
    expect(html).toContain('id="wm-pattern-test-1"');
    expect(html).toContain('研发专案');
    expect(html).toContain('fill="#2563eb"');
    expect(html).toContain('fill-opacity="0.2"');
    expect(html).toContain('rotate(-30)');
    expect(html).toMatch(/<text\s+x="\d+(?:\.\d+)?"\s+y="\d+(?:\.\d+)?"/);
    expect(html).not.toContain('x="50%"');
  });

  it('renders watermark HTML for single centered watermark', () => {
    const html = renderWatermarkHtml(
      {
        ...DEFAULT_WATERMARK_CONFIG,
        show: true,
        text: 'TOP SECRET',
        layout: 'single',
        rotate: -45,
      },
      false,
      'test-single',
    );

    expect(html).toContain('doc-watermark-overlay');
    expect(html).toContain('transform: rotate(-45deg)');
    expect(html).toContain('TOP SECRET');
  });

  it('renders image watermark when configured', () => {
    const html = renderWatermarkHtml(
      {
        ...DEFAULT_WATERMARK_CONFIG,
        show: true,
        type: 'image',
        imageUrl: 'https://example.com/logo.png',
        imageWidth: 100,
        layout: 'single',
      },
      false,
      'img-1',
    );

    expect(html).toContain('<use href="#doc-watermark-image"');
    expect(html).not.toContain('https://example.com/logo.png');
    expect(renderWatermarkImageDefinition({
      ...DEFAULT_WATERMARK_CONFIG,
      show: true,
      type: 'image',
      imageUrl: 'https://example.com/logo.png',
    })).toContain('href="https://example.com/logo.png"');
  });

  it('respects hideOnCover on cover page', () => {
    const wm = {
      ...DEFAULT_WATERMARK_CONFIG,
      show: true,
      text: '内部资料',
      hideOnCover: true,
    };

    // On cover page with hideOnCover = true -> returns empty string
    expect(renderWatermarkHtml(wm, true, 'cover')).toBe('');

    // On non-cover page -> returns overlay
    expect(renderWatermarkHtml(wm, false, 'content-1')).toContain('内部资料');

    // On cover page with hideOnCover = false -> returns overlay
    expect(renderWatermarkHtml({ ...wm, hideOnCover: false }, true, 'cover')).toContain('内部资料');
  });

  it('returns empty string when show is false', () => {
    const html = renderWatermarkHtml({ ...DEFAULT_WATERMARK_CONFIG, show: false }, false, 'p1');
    expect(html).toBe('');
  });
});
