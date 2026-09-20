import React from 'react';
import { WatermarkConfig } from '../types';
import { getWatermarkConfig, calculateWatermarkMetrics } from '../utils/watermark';
import { resolveImageSrc } from '../utils/tauriHelper';

interface WatermarkOverlayProps {
  watermark?: WatermarkConfig;
  isCover?: boolean;
  pageNum: number | string;
}

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({
  watermark,
  isCover = false,
  pageNum,
}) => {
  if (!watermark || !watermark.show) return null;
  if (isCover && watermark.hideOnCover !== false) return null;

  const config = getWatermarkConfig(watermark);
  const patternId = `wm-preview-pattern-${pageNum}`;
  const imageSrc = config.imageUrl ? resolveImageSrc(config.imageUrl) : '';

  if (config.layout === 'single') {
    return (
      <div
        className="pointer-events-none select-none absolute inset-0 overflow-hidden flex items-center justify-center z-1"
        aria-hidden="true"
      >
        <div
          style={{
            transform: `rotate(${config.rotate}deg)`,
            transformOrigin: 'center center',
            opacity: config.opacity,
            userSelect: 'none',
          }}
        >
          {config.type === 'image' && imageSrc ? (
            <img
              src={imageSrc}
              style={{
                width: `${(config.imageWidth || 120) * 1.8}px`,
                height: 'auto',
                display: 'block',
                maxWidth: 'none',
              }}
              alt=""
              className="pointer-events-none select-none"
            />
          ) : (
            <span
              style={{
                color: config.color,
                fontSize: `${Math.round(config.fontSize * 1.8)}px`,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
                fontWeight: 700,
                letterSpacing: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {config.text}
            </span>
          )}
        </div>
      </div>
    );
  }

  const { patternWidth, patternHeight } = calculateWatermarkMetrics(config);

  return (
    <div
      className="pointer-events-none select-none absolute inset-0 overflow-hidden z-1"
      aria-hidden="true"
    >
      <svg className="w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id={patternId}
            width={patternWidth}
            height={patternHeight}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${config.rotate})`}
          >
            {config.type === 'image' && imageSrc ? (
              <image
                href={imageSrc}
                x={(patternWidth - (config.imageWidth || 120)) / 2}
                y={(patternHeight - (config.imageWidth || 120) * 0.7) / 2}
                width={config.imageWidth || 120}
                height={(config.imageWidth || 120) * 0.7}
                opacity={config.opacity}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <text
                x={patternWidth / 2}
                y={patternHeight / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={config.color}
                fillOpacity={config.opacity}
                fontSize={`${config.fontSize}px`}
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif"
                fontWeight="bold"
                letterSpacing="2px"
              >
                {config.text}
              </text>
            )}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
};
