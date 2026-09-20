import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Gauge,
  Images,
  Loader,
  Minimize2,
  Ruler,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { DocumentAsset, DocumentTheme } from '../types';
import { saveAsset, removeAsset } from '../utils/assetStorage';
import { renderAssetToWebp } from '../utils/imageCompression';
import { planDocumentImageOptimization } from '../utils/imageBatchOptimizer';

interface BatchImageOptimizerProps {
  isOpen: boolean;
  documentId: string;
  assets: DocumentAsset[];
  markdown: string;
  theme: DocumentTheme;
  isDark: boolean;
  onClose: () => void;
  onAssetsChanged: () => Promise<void>;
}

interface BatchOptimizationResult {
  compressed: number;
  resampled: number;
  removed: number;
  skipped: number;
  savedBytes: number;
}

const RESAMPLE_SCALES = [
  { value: 1, label: '1x', hint: '体积最小' },
  { value: 1.5, label: '1.5x', hint: '均衡' },
  { value: 2, label: '2x', hint: '更清晰' },
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const BatchImageOptimizer: React.FC<BatchImageOptimizerProps> = ({
  isOpen,
  documentId,
  assets,
  markdown,
  theme,
  isDark,
  onClose,
  onAssetsChanged,
}) => {
  const [quality, setQuality] = useState(0.8);
  const [resample, setResample] = useState(false);
  const [scale, setScale] = useState<number>(2);
  const [removeUnused, setRemoveUnused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<BatchOptimizationResult | null>(null);

  const plan = useMemo(
    () => planDocumentImageOptimization(assets, markdown, theme),
    [assets, markdown, theme],
  );
  const unusedIds = useMemo(() => new Set(plan.unused.map((asset) => asset.id)), [plan]);
  const targets = useMemo(
    () => (removeUnused ? plan.compressible.filter((asset) => !unusedIds.has(asset.id)) : plan.compressible),
    [plan.compressible, removeUnused, unusedIds],
  );

  useEffect(() => {
    if (isOpen) {
      setError('');
      setProgress('');
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetBytes = targets.reduce((total, asset) => total + asset.byteLength, 0);
  const removableBytes = removeUnused ? plan.unusedBytes : 0;
  const canRun = !busy && (targets.length > 0 || (removeUnused && plan.unused.length > 0));

  const handleRun = async () => {
    setBusy(true);
    setError('');
    setResult(null);

    const stats: BatchOptimizationResult = { compressed: 0, resampled: 0, removed: 0, skipped: 0, savedBytes: 0 };
    const total = targets.length + (removeUnused ? plan.unused.length : 0);
    let done = 0;
    let assetsChanged = false;
    let operationError: unknown;

    try {
      for (const asset of targets) {
        setProgress(`正在压缩 ${done + 1}/${total}：${asset.fileName}`);
        const rendered = await renderAssetToWebp(asset, {
          quality,
          display: resample ? plan.displaySizes.get(asset.id) : undefined,
          scale,
        });
        done += 1;
        if (rendered.asset.byteLength >= asset.byteLength) {
          stats.skipped += 1;
          continue;
        }
        // 沿用原图 ID：正文、封面与页眉中的引用保持不变
        await saveAsset(documentId, {
          ...rendered.asset,
          id: asset.id,
          description: asset.description || rendered.asset.description,
        });
        assetsChanged = true;
        stats.compressed += 1;
        stats.savedBytes += asset.byteLength - rendered.asset.byteLength;
        if (rendered.outputSize.width !== rendered.originalSize.width) stats.resampled += 1;
      }

      if (removeUnused) {
        for (const asset of plan.unused) {
          setProgress(`正在移除未引用图片 ${done + 1}/${total}：${asset.fileName}`);
          await removeAsset(documentId, asset);
          assetsChanged = true;
          done += 1;
          stats.removed += 1;
          stats.savedBytes += asset.byteLength;
        }
      }

    } catch (optimizationError) {
      operationError = optimizationError;
    } finally {
      if (assetsChanged) {
        try {
          await onAssetsChanged();
        } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : '图片已处理，但列表刷新失败');
          setProgress('');
          setBusy(false);
          return;
        }
      }
      if (operationError) {
        setError(operationError instanceof Error ? operationError.message : '图片压缩失败');
      } else {
        setResult(stats);
      }
      setProgress('');
      setBusy(false);
    }
  };

  const cardClass = `rounded-xl border p-4 ${isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'}`;
  const labelClass = `text-xs font-bold ${isDark ? 'text-zinc-200' : 'text-slate-700'}`;
  const hintClass = `text-[11px] leading-relaxed ${isDark ? 'text-zinc-500' : 'text-slate-400'}`;

  return (
    <div
      className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="文档图片整体压缩"
      onClick={() => !busy && onClose()}
    >
      <div
        className={`w-full max-w-2xl max-h-[88vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${
          isDark ? 'bg-[#161616] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-start justify-between gap-3 shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#191919]' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">文档图片整体压缩</h2>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                批量将非 WebP 图片转换为 WebP，可选重采样分辨率与移除未引用图片，用于优化文档体积
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className={`p-2 rounded-lg transition disabled:opacity-40 ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-200/80 text-slate-500 hover:text-slate-800'
            }`}
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {/* Overview */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '文档相关图片', count: plan.totalCount, note: formatBytes(plan.totalBytes) },
              { label: '本次压缩（非 WebP）', count: targets.length, note: formatBytes(targetBytes) },
              { label: '未引用图片', count: plan.unused.length, note: formatBytes(removableBytes) },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-3 ${isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`text-[10px] font-semibold ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{item.label}</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-lg font-bold leading-none">{item.count}</span>
                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>张</span>
                </div>
                <div className={`text-[10px] mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>{item.note}</div>
              </div>
            ))}
          </div>

          {/* Quality */}
          <div className={cardClass}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className={labelClass}>WebP 质量</span>
              </div>
              <span className="font-mono text-xs text-blue-500 font-bold">{Math.round(quality * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={quality}
              disabled={busy}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full mt-2 accent-blue-600 h-1.5"
            />
            <p className={`mt-1.5 ${hintClass}`}>质量越低体积越小；仅在压缩后体积确实变小时才会替换原图。</p>
          </div>

          {/* Resample */}
          <div className={cardClass}>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={resample}
                disabled={busy}
                onChange={(e) => setResample(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 accent-blue-600"
              />
              <span>
                <span className="flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-blue-500" />
                  <span className={labelClass}>处理分辨率（重采样）</span>
                </span>
                <span className={`block mt-1 ${hintClass}`}>
                  仅作用于正文、封面或页眉中设置了宽度或高度的图片：目标像素 = 显示尺寸 × 倍率，不会放大原图，未设置尺寸的图片只做格式压缩。
                </span>
              </span>
            </label>

            <div className="flex items-center gap-2 mt-3 pl-6">
              <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>清晰度倍率</span>
              <div className={`flex p-1 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'}`}>
                {RESAMPLE_SCALES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={busy || !resample}
                    onClick={() => setScale(option.value)}
                    title={option.hint}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition disabled:opacity-40 ${
                      scale === option.value && resample
                        ? 'bg-blue-600 text-white shadow-xs'
                        : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                {plan.displaySizes.size > 0 ? `已识别 ${plan.displaySizes.size} 张带尺寸设置的图片` : '当前文档暂无尺寸设置'}
              </span>
            </div>
          </div>

          {/* Remove unused */}
          <div className={cardClass}>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={removeUnused}
                disabled={busy || plan.unused.length === 0}
                onChange={(e) => setRemoveUnused(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 accent-red-600"
              />
              <span>
                <span className="flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span className={labelClass}>
                    移除未引用图片（{plan.unused.length} 张，{formatBytes(plan.unusedBytes)}）
                  </span>
                </span>
                <span className={`block mt-1 ${hintClass}`}>
                  仅删除本文档中未被正文、封面或页眉引用的图片；删除不可撤销，且引用这些图片的历史版本会同步失效。素材库图片不会被删除。
                </span>
              </span>
            </label>
          </div>

          {/* Result & progress */}
          {result && (
            <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <div className="font-bold">优化完成</div>
                <div className="mt-0.5">
                  压缩 {result.compressed} 张{result.resampled > 0 ? `（其中重采样 ${result.resampled} 张）` : ''}
                  {result.removed > 0 ? `，移除未引用 ${result.removed} 张` : ''}
                  {result.skipped > 0 ? `，跳过 ${result.skipped} 张（压缩后体积未减小）` : ''}
                  ，共节省 {formatBytes(result.savedBytes)}。
                </div>
              </div>
            </div>
          )}

          {progress && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
              <Loader className="w-3.5 h-3.5 animate-spin" />
              <span className="truncate">{progress}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!canRun && !busy && !result && (
            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              <Images className="w-3.5 h-3.5" />
              <span>
                {plan.totalCount === 0
                  ? '当前文档暂无图片，上传或收集图片后可在此批量优化'
                  : plan.unused.length > 0
                    ? '勾选「移除未引用图片」后仍可执行清理'
                    : '当前文档的图片均为 WebP 或矢量图，无需压缩'}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#191919]' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className={`flex items-center gap-1.5 text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
            <Minimize2 className="w-3.5 h-3.5" />
            <span>压缩结果会直接替换原图，引用保持不变</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition disabled:opacity-40 ${
                isDark ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              关闭
            </button>
            <button
              type="button"
              disabled={!canRun}
              onClick={() => void handleRun()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {busy ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
              <span>{busy ? '正在优化…' : '开始优化'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
