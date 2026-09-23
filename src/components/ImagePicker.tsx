import React, { useEffect, useState, useMemo } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Check, Images, Plus, X, Search, Image as ImageIcon } from 'lucide-react';
import type { DocumentAsset, DocumentAssetScope } from '../types';
import type { ImageDimensions } from '../utils/imageDimensions';
import { getAssetReference } from '../utils/assetUrlRegistry';
import { resolveImageSrc } from '../utils/tauriHelper';

interface ImagePickerProps {
  isOpen: boolean;
  assets: DocumentAsset[];
  currentReference?: string;
  isDark: boolean;
  showDimensions?: boolean;
  onClose: () => void;
  onSelect: (reference: string, asset: DocumentAsset, dimensions?: ImageDimensions) => void;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({
  isOpen,
  assets,
  currentReference,
  isDark,
  showDimensions = false,
  onClose,
  onSelect,
}) => {
  const [scope, setScope] = useState<DocumentAssetScope>('document');
  const [selectedReference, setSelectedReference] = useState(currentReference || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [alignment, setAlignment] = useState<ImageDimensions['align']>();

  useEffect(() => {
    if (!isOpen) return;
    setSelectedReference(currentReference || '');
    setWidth('');
    setHeight('');
    setAlignment(undefined);
    setSearchQuery('');
  }, [currentReference, isOpen]);

  const scopeAssets = useMemo(() => {
    return assets.filter((asset) => asset.scope === scope);
  }, [assets, scope]);

  const filteredAssets = useMemo(() => {
    if (!searchQuery.trim()) return scopeAssets;
    const q = searchQuery.toLowerCase();
    return scopeAssets.filter(
      (a) => a.fileName.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q))
    );
  }, [scopeAssets, searchQuery]);

  const selectedAsset = useMemo(() => {
    return assets.find((asset) => getAssetReference(asset) === selectedReference);
  }, [assets, selectedReference]);

  if (!isOpen) return null;

  const docCount = assets.filter((a) => a.scope === 'document').length;
  const libCount = assets.filter((a) => a.scope === 'library').length;

  const handleConfirmSelect = () => {
    if (!selectedAsset) return;
    onSelect(selectedReference, selectedAsset, {
      width: width ? Number(width) : undefined,
      height: height ? Number(height) : undefined,
      align: alignment,
    });
  };

  const getFormatBadge = (mediaType: string) => {
    if (mediaType.includes('png')) return 'PNG';
    if (mediaType.includes('jpeg') || mediaType.includes('jpg')) return 'JPG';
    if (mediaType.includes('webp')) return 'WEBP';
    if (mediaType.includes('svg')) return 'SVG';
    return 'IMG';
  };

  return (
    <div 
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200" 
      role="dialog" 
      aria-modal="true" 
      aria-label="选择图片"
    >
      <div 
        className={`w-full max-w-4xl max-h-[85vh] border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark 
            ? 'bg-[#161616] border-zinc-800 text-zinc-100' 
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Modal Header */}
        <div className={`h-14 px-6 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#191919]' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 border border-blue-500/20 flex items-center justify-center">
              <Images className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">选择图片素材</h2>
              <p className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                双击图片或选中后点击确认
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className={`p-1.5 rounded-lg transition ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-200/80 text-slate-500 hover:text-slate-800'
            }`} 
            title="关闭窗口 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className={`px-6 py-2.5 border-b flex items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#161616]' : 'border-slate-100 bg-white'
        }`}>
          {/* Scope Segmented Control */}
          <div className={`flex p-0.5 rounded-lg border ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setScope('document')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                scope === 'document'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>当前文档</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                scope === 'document' ? 'bg-white/20 text-white' : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-600'
              }`}>
                {docCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setScope('library')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                scope === 'library'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>永久图片库</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                scope === 'library' ? 'bg-white/20 text-white' : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-600'
              }`}>
                {libCount}
              </span>
            </button>
          </div>

          {/* Search box */}
          <div className={`relative flex items-center rounded-lg border px-2.5 py-1 ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索图片..."
              className="w-32 text-xs bg-transparent outline-hidden placeholder:text-zinc-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-0.5 rounded hover:bg-zinc-500/20 text-zinc-400">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden">
        {/* Gallery Grid */}
        <div className="sm:flex-1 min-w-0 min-h-[180px] max-h-[40vh] sm:max-h-none sm:min-h-0 overflow-y-auto p-5">
          {filteredAssets.length > 0 ? (
            <div className="grid content-start grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredAssets.map((asset) => {
                const reference = getAssetReference(asset);
                const isSelected = reference === selectedReference;
                const format = getFormatBadge(asset.mediaType);

                return (
                  <div
                    key={`${asset.scope}:${asset.id}`}
                    onClick={() => setSelectedReference(reference)}
                    onDoubleClick={() => {
                      setSelectedReference(reference);
                      if (!showDimensions) {
                        onSelect(reference, asset);
                      }
                    }}
                    className={`group relative rounded-xl border p-2 text-left cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md bg-blue-50/5' 
                        : isDark 
                        ? 'border-zinc-800/90 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900' 
                        : 'border-slate-200/90 hover:border-slate-300 bg-white hover:shadow-xs'
                    }`}
                  >
                    {/* Thumbnail with checkerboard pattern */}
                    <div className="relative w-full h-24 rounded-lg overflow-hidden flex items-center justify-center bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] dark:bg-[linear-gradient(45deg,#202020_25%,transparent_25%),linear-gradient(-45deg,#202020_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#202020_75%),linear-gradient(-45deg,transparent_75%,#202020_75%)]">
                      <img 
                        src={resolveImageSrc(reference)} 
                        alt={asset.description || asset.fileName} 
                        className="w-full h-full object-contain p-1 select-none" 
                        loading="lazy"
                      />

                      {/* Format Badge */}
                      <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded text-[8px] font-bold bg-black/60 text-white backdrop-blur-xs">
                        {format}
                      </span>

                      {/* Selected Check Indicator */}
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <div className="mt-2 px-0.5">
                      <div className="text-xs font-semibold truncate" title={asset.description || asset.fileName}>
                        {asset.description || asset.fileName}
                      </div>
                      <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                        {Math.ceil(asset.byteLength / 1024)} KB · {asset.fileName}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-8">
              <ImageIcon className={`w-10 h-10 mb-2 ${isDark ? 'text-zinc-600' : 'text-slate-300'}`} />
              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                {searchQuery ? '未找到匹配的图片' : '暂无可选图片，请先在顶部“图片”管理中添加'}
              </p>
            </div>
          )}
        </div>

        {showDimensions && (
          <aside aria-label="图片属性" className={`shrink-0 sm:w-64 sm:overflow-y-auto border-t sm:border-t-0 sm:border-l p-5 ${
            isDark ? 'border-zinc-800 bg-[#191919]' : 'border-slate-100 bg-slate-50/70'
          }`}>
            <h3 className="text-xs font-bold mb-5">图片属性</h3>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className={`text-[11px] font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>尺寸</div>
                <label className="flex items-center gap-2 text-xs">
                  <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>宽</span>
                  <input 
                    type="number" 
                    min="1" 
                    step="1" 
                    value={width} 
                    onChange={(e) => setWidth(e.target.value)} 
                    placeholder="自适应" 
                    className={`w-24 rounded-md border px-2 py-1 text-xs outline-hidden ${
                      isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`} 
                  />
                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>px</span>
                </label>

                <label className="flex items-center gap-2 text-xs">
                  <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>高</span>
                  <input 
                    type="number" 
                    min="1" 
                    step="1" 
                    value={height} 
                    onChange={(e) => setHeight(e.target.value)} 
                    placeholder="自适应" 
                    className={`w-24 rounded-md border px-2 py-1 text-xs outline-hidden ${
                      isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`} 
                  />
                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>px</span>
                </label>
              </div>

              <div className="space-y-2">
                <div className={`text-[11px] font-semibold ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>图片对齐</div>
                <div role="group" aria-label="图片对齐方式" className={`flex p-0.5 rounded-md border ${isDark ? 'border-zinc-700 bg-zinc-900' : 'border-slate-200 bg-white'}`}>
                  {([
                    { value: undefined, label: '默认', icon: null },
                    { value: 'left', label: '左对齐', icon: AlignLeft },
                    { value: 'center', label: '居中', icon: AlignCenter },
                    { value: 'right', label: '右对齐', icon: AlignRight },
                  ] as const).map(({ value, label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-pressed={alignment === value}
                      onClick={() => setAlignment(value)}
                      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-[11px] transition ${alignment === value
                        ? 'bg-blue-600 text-white'
                        : isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {Icon ? <Icon className="w-3.5 h-3.5" /> : label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick width preset pills */}
              <div className="flex flex-wrap items-center gap-1">
                {[300, 500, 700].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setWidth(String(val)); setHeight(''); }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                      width === String(val)
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : isDark ? 'border-zinc-800 text-zinc-400 hover:text-white' : 'border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {val}px
                  </button>
                ))}
                {(width || height) && (
                  <button
                    type="button"
                    onClick={() => { setWidth(''); setHeight(''); }}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                      isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    清除尺寸
                  </button>
                )}
              </div>
            </div>
          </aside>
        )}
        </div>

        {/* Footer Actions */}
        <div className={`px-6 py-3 border-t flex items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#191919]' : 'border-slate-100 bg-slate-50/70'
        }`}>
            <div className="min-w-0 flex-1 truncate text-xs">
              {selectedAsset ? (
                <span className={`truncate ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                  已选择: <strong className={isDark ? 'text-white' : 'text-slate-900'}>{selectedAsset.fileName}</strong>
                </span>
              ) : (
                <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>请选择一张图片</span>
              )}
            </div>

          {/* Bottom Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                isDark 
                  ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' 
                  : 'border-slate-200 text-slate-700 hover:bg-white'
              }`}
            >
              取消
            </button>
            <button
              type="button"
              disabled={!selectedAsset}
              onClick={handleConfirmSelect}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showDimensions ? '插入图片' : '确认选择'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
