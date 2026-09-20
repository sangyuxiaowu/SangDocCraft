import React, { useRef, useState, useMemo } from 'react';
import { 
  Clipboard, 
  CloudDownload, 
  Images, 
  PackagePlus, 
  Trash2, 
  X, 
  Search, 
  Check, 
  FileCode, 
  Sparkles,
  AlertCircle,
  UploadCloud
} from 'lucide-react';
import type { DocumentAsset, DocumentAssetScope, DocumentTheme } from '../types';
import { getAssetReference, registerAssetUrl, unregisterAssetUrl } from '../utils/assetUrlRegistry';
import { compressAssetToWebp } from '../utils/imageCompression';
import { createDocumentAsset } from '../utils/documentPackage';
import { deleteAsset, putDocumentAsset, putLibraryAsset } from '../utils/imageRepository';
import { isImageReferenced } from '../utils/imageReferences';
import { resolveImageSrc } from '../utils/tauriHelper';
import { collectDocumentNetworkImages } from '../utils/networkImageCollector';

interface ImageManagerProps {
  isOpen: boolean;
  documentId: string;
  assets: DocumentAsset[];
  markdown: string;
  theme: DocumentTheme;
  isDark: boolean;
  onClose: () => void;
  onAssetsChanged: () => Promise<void>;
  onInsert: (markdown: string) => void;
  onDocumentContentChange: (markdown: string, theme: DocumentTheme) => void;
}

async function saveAsset(documentId: string, asset: DocumentAsset): Promise<void> {
  if (asset.scope === 'library') await putLibraryAsset(asset);
  else await putDocumentAsset(documentId, asset);
  registerAssetUrl(asset);
}

export const ImageManager: React.FC<ImageManagerProps> = ({
  isOpen,
  documentId,
  assets,
  markdown,
  theme,
  isDark,
  onClose,
  onAssetsChanged,
  onInsert,
  onDocumentContentChange,
}) => {
  const [scope, setScope] = useState<DocumentAssetScope>('document');
  const [selectedId, setSelectedId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [quality, setQuality] = useState(0.8);
  const [busy, setBusy] = useState(false);
  const [copiedType, setCopiedType] = useState<'ref' | 'md' | null>(null);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<DocumentAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const selected = useMemo(() => {
    return filteredAssets.find((asset) => asset.id === selectedId) || 
           scopeAssets.find((asset) => asset.id === selectedId) || 
           filteredAssets[0] || 
           scopeAssets[0];
  }, [filteredAssets, scopeAssets, selectedId]);

  if (!isOpen) return null;

  const referenced = selected ? isImageReferenced(selected.id, selected.scope, markdown, theme) : false;
  const docAssetCount = assets.filter((a) => a.scope === 'document').length;
  const libAssetCount = assets.filter((a) => a.scope === 'library').length;

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      await onAssetsChanged();
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : '图片操作失败');
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = (files: FileList | null) => run(async () => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) return;
    for (const file of list) {
      const asset = await createDocumentAsset(new Uint8Array(await file.arrayBuffer()), {
        fileName: file.name,
        mediaType: file.type,
        scope,
      });
      await saveAsset(documentId, asset);
      setSelectedId(asset.id);
    }
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const collectImagesFromDocument = () => run(async () => {
    const collected = await collectDocumentNetworkImages(markdown, theme);
    if (collected.assets.length === 0) {
      setError('当前正文、封面与页眉中未检测到可收集的外部网络图片');
      return;
    }
    for (const asset of collected.assets) await saveAsset(documentId, asset);
    onDocumentContentChange(collected.markdown, collected.theme);
    setSelectedId(collected.assets[0].id);
  });

  const compressSelected = () => selected && run(async () => {
    const compressed = await compressAssetToWebp(selected, quality);
    await saveAsset(documentId, compressed);
    setSelectedId(compressed.id);
  });

  const handleDeleteClick = () => {
    if (selected && !referenced) {
      setAssetToDelete(selected);
    }
  };

  const confirmDelete = () => {
    if (!assetToDelete) return;
    const target = assetToDelete;
    setAssetToDelete(null);
    void run(async () => {
      await deleteAsset(documentId, target);
      unregisterAssetUrl(getAssetReference(target));
      if (selectedId === target.id) {
        setSelectedId('');
      }
    });
  };

  const copyToClipboard = async (text: string, type: 'ref' | 'md') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // fallback
    }
  };

  const getFormatBadge = (mediaType: string) => {
    if (mediaType.includes('png')) return 'PNG';
    if (mediaType.includes('jpeg') || mediaType.includes('jpg')) return 'JPG';
    if (mediaType.includes('webp')) return 'WEBP';
    if (mediaType.includes('svg')) return 'SVG';
    if (mediaType.includes('gif')) return 'GIF';
    return 'IMG';
  };

  return (
    <div 
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200" 
      role="dialog" 
      aria-modal="true" 
      aria-label="图片管理"
    >
      <div 
        className={`w-full max-w-5xl h-[min(780px,90vh)] border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isDark 
            ? 'bg-[#161616] border-zinc-800 text-zinc-100' 
            : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
        }`}
      >
        {/* Modal Header */}
        <div className={`h-15 px-6 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#191919]' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-500/20 flex items-center justify-center">
              <Images className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">文档图片资源管理</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  共 {assets.length} 张图片
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                收集、压缩优化与管理正文、封面和页眉中使用的所有图片
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className={`p-2 rounded-lg transition ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-200/80 text-slate-500 hover:text-slate-800'
            }`} 
            title="关闭窗口 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Scopes, Upload, Scan Document, Search */}
        <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-zinc-800/80 bg-[#161616]' : 'border-slate-100 bg-white'
        }`}>
          {/* Scope Segmented Switch */}
          <div className={`flex p-1 rounded-xl border ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-100 border-slate-200'
          }`}>
            <button 
              onClick={() => { setScope('document'); setSelectedId(''); }} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                scope === 'document' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>当前文档图片</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                scope === 'document' ? 'bg-white/20 text-white' : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-600'
              }`}>
                {docAssetCount}
              </span>
            </button>
            <button 
              onClick={() => { setScope('library'); setSelectedId(''); }} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                scope === 'library' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>永久素材库</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                scope === 'library' ? 'bg-white/20 text-white' : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-600'
              }`}>
                {libAssetCount}
              </span>
            </button>
          </div>

          {/* Actions & Search */}
          <div className="flex items-center gap-2 flex-wrap">
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              multiple 
              className="hidden" 
              onChange={(e) => void handleFiles(e.target.files)} 
            />

            <button 
              disabled={busy} 
              onClick={() => fileInputRef.current?.click()} 
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              <span>上传图片</span>
            </button>

            <button 
              disabled={busy} 
              onClick={() => void collectImagesFromDocument()} 
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 ${
                isDark 
                  ? 'border-zinc-700 hover:border-zinc-600 bg-zinc-900 text-zinc-200' 
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 shadow-xs'
              }`}
              title="自动扫描 Markdown 正文、封面与页眉中的网络图片 (http:// 或 https://) 并本地化保存"
            >
              <CloudDownload className="w-3.5 h-3.5 text-blue-500" />
              <span>收集文档网络图片</span>
            </button>

            {/* Search filter input */}
            <div className={`relative flex items-center rounded-lg border px-2.5 py-1 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索图片名称..."
                className="w-28 sm:w-36 text-xs bg-transparent outline-hidden placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-0.5 rounded hover:bg-zinc-500/20 text-zinc-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Work Area: Gallery (Left) + Detail Inspector (Right) */}
        <div className="flex-1 min-h-0 grid grid-rows-[minmax(220px,1fr)_auto] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_320px]">
          
          {/* Gallery View */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`overflow-auto p-5 relative transition-colors ${
              isDragOver ? (isDark ? 'bg-blue-950/20 ring-2 ring-blue-500 inset-0' : 'bg-blue-50/50 ring-2 ring-blue-500') : ''
            }`}
          >
            {filteredAssets.length > 0 ? (
              <div className="grid content-start grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
                {filteredAssets.map((asset) => {
                  const isSelected = selected?.id === asset.id;
                  const isRef = isImageReferenced(asset.id, asset.scope, markdown, theme);
                  const format = getFormatBadge(asset.mediaType);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedId(asset.id)}
                      className={`group relative rounded-xl border p-2 text-left cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md bg-blue-50/5' 
                          : isDark 
                          ? 'border-zinc-800/90 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900' 
                          : 'border-slate-200/90 hover:border-slate-300 bg-white hover:shadow-xs'
                      }`}
                    >
                      {/* Image Thumbnail with transparency pattern */}
                      <div className="relative w-full h-28 rounded-lg overflow-hidden flex items-center justify-center bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[size:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] dark:bg-[linear-gradient(45deg,#202020_25%,transparent_25%),linear-gradient(-45deg,#202020_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#202020_75%),linear-gradient(-45deg,transparent_75%,#202020_75%)]">
                        <img 
                          src={resolveImageSrc(getAssetReference(asset))} 
                          alt={asset.description || asset.fileName} 
                          className="w-full h-full object-contain p-1 select-none" 
                          loading="lazy"
                        />
                        
                        {/* Format Tag */}
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white backdrop-blur-xs">
                          {format}
                        </span>

                        {/* Referenced Tag or Quick Delete */}
                        {isRef ? (
                          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-600/90 text-white shadow-xs" title="正文、封面或页眉正在引用">
                            引用中
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssetToDelete(asset);
                            }}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs shadow-xs"
                            title="删除此图片"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Info & Title */}
                      <div className="mt-2.5 px-0.5">
                        <div className="text-xs font-semibold truncate" title={asset.fileName}>
                          {asset.fileName}
                        </div>
                        <div className={`mt-0.5 flex items-center justify-between text-[10px] ${
                          isDark ? 'text-zinc-500' : 'text-slate-400'
                        }`}>
                          <span>{Math.ceil(asset.byteLength / 1024)} KB</span>
                          {asset.description && <span className="truncate max-w-[100px]">{asset.description}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State */
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${
                  isDark ? 'bg-zinc-800/80 text-zinc-500' : 'bg-slate-100 text-slate-400'
                }`}>
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold mb-1">
                  {searchQuery ? '未找到匹配的图片' : (scope === 'document' ? '当前文档暂无图片' : '永久素材库暂无图片')}
                </h3>
                <p className={`text-xs max-w-sm mb-4 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  {searchQuery 
                    ? '请尝试更换关键词搜索' 
                    : '支持将图片文件直接拖拽至此处，或点击上方按钮批量上传。'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
                  >
                    立即上传图片
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Inspector / Detail Sidebar */}
          <aside className={`border-t md:border-t-0 md:border-l p-5 flex flex-col gap-4 overflow-y-auto ${
            isDark ? 'border-zinc-800 bg-[#181818]' : 'border-slate-100 bg-slate-50/50'
          }`}>
            {selected ? (
              <>
                {/* Large Preview */}
                <div className="rounded-xl overflow-hidden border border-inherit p-2 flex items-center justify-center bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[size:16px_16px] dark:bg-[linear-gradient(45deg,#202020_25%,transparent_25%),linear-gradient(-45deg,#202020_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#202020_75%)]">
                  <img 
                    src={resolveImageSrc(getAssetReference(selected))} 
                    alt={selected.description || selected.fileName} 
                    className="max-h-40 w-full object-contain select-none" 
                  />
                </div>

                {/* Metadata details */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>文件大小</span>
                    <span className="font-semibold">{Math.ceil(selected.byteLength / 1024)} KB</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>文件格式</span>
                    <span className="font-semibold uppercase">{getFormatBadge(selected.mediaType)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>引用状态</span>
                    <span className={`font-semibold ${referenced ? 'text-emerald-500' : isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                      {referenced ? '正文中引用中' : '未引用'}
                    </span>
                  </div>
                </div>

                <div className={`h-px w-full ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

                {/* Reference Code Box */}
                <div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                    isDark ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    内部资源引用标识
                  </div>
                  <div className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono select-all ${
                    isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
                  }`}>
                    <span className="truncate mr-2 text-[11px]">{getAssetReference(selected)}</span>
                    <button
                      onClick={() => void copyToClipboard(getAssetReference(selected), 'ref')}
                      className={`p-1 rounded transition shrink-0 ${
                        copiedType === 'ref' 
                          ? 'text-emerald-500 bg-emerald-500/10' 
                          : isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-slate-100 text-slate-500'
                      }`}
                      title="复制引用标识"
                    >
                      {copiedType === 'ref' ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Editable Description */}
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                    isDark ? 'text-zinc-500' : 'text-slate-400'
                  }`}>
                    图片备注与说明
                  </label>
                  <input 
                    key={selected.id} 
                    defaultValue={selected.description} 
                    placeholder="输入图注或说明文字..."
                    onBlur={(e) => {
                      if (e.target.value === selected.description) return;
                      void run(() => saveAsset(documentId, { ...selected, description: e.target.value.trim() }));
                    }} 
                    className={`w-full rounded-lg border px-3 py-1.5 text-xs outline-hidden transition ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-800 focus:border-blue-500'
                    }`} 
                  />
                </div>

                {/* WebP Compression Section */}
                {selected.mediaType !== 'image/svg+xml' && (
                  <div className={`p-3 rounded-xl border ${
                    isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between text-xs font-semibold mb-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>WebP 质量压缩</span>
                      </div>
                      <span className="font-mono text-blue-500 font-bold">{Math.round(quality * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.1" 
                      max="1" 
                      step="0.05" 
                      value={quality} 
                      onChange={(e) => setQuality(Number(e.target.value))} 
                      className="w-full accent-blue-600 h-1.5" 
                    />
                    <button 
                      disabled={busy} 
                      onClick={() => void compressSelected()} 
                      className={`w-full mt-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${
                        isDark 
                          ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-200' 
                          : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      生成 WebP 优化副本
                    </button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-1 mt-auto">
                  <button 
                    onClick={() => {
                      onInsert(`![${selected.description || selected.fileName}](${getAssetReference(selected)})`);
                      onClose();
                    }} 
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>插入至光标处</span>
                  </button>

                  <button 
                    onClick={() => void copyToClipboard(`![${selected.description || selected.fileName}](${getAssetReference(selected)})`, 'md')} 
                    className={`w-full py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      copiedType === 'md'
                        ? 'border-emerald-500 text-emerald-500'
                        : isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'border-slate-200 hover:bg-white text-slate-700'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{copiedType === 'md' ? '已复制 Markdown 语法!' : '复制 Markdown 语法'}</span>
                  </button>

                  <button 
                    type="button"
                    disabled={busy || referenced} 
                    onClick={handleDeleteClick} 
                    className={`w-full py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      isDark 
                        ? 'border-red-500/20 text-red-400 hover:bg-red-500/10' 
                        : 'border-red-200 text-red-600 hover:bg-red-50'
                    }`} 
                    title={referenced ? '该图片当前正在被正文、封面或页眉引用，无法删除' : '彻底删除该图片'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{referenced ? '正文中引用中 (不可删)' : '删除此图片'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <Images className={`w-8 h-8 mb-2 ${isDark ? 'text-zinc-600' : 'text-slate-300'}`} />
                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  请从左侧选择一张图片以查看详情与操作
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}
          </aside>

        </div>
      </div>

      {/* Delete Confirmation Modal Dialog */}
      {assetToDelete && (
        <div 
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          aria-describedby="delete-modal-desc"
          onClick={() => !busy && setAssetToDelete(null)}
        >
          <div 
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 p-6 ${
              isDark ? 'bg-[#1a1a1a] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 id="delete-modal-title" className="text-base font-bold">
                  确认删除图片
                </h3>
                <p id="delete-modal-desc" className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  您确定要从{assetToDelete.scope === 'library' ? '永久图片库' : '当前文档包'}中删除此图片吗？
                </p>
              </div>
            </div>

            {/* Target Card Preview */}
            <div className={`mt-4 p-3 rounded-xl border flex items-center gap-3 ${
              isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-12 h-12 rounded-lg bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)] bg-[size:10px_10px] dark:bg-[linear-gradient(45deg,#202020_25%,transparent_25%),linear-gradient(-45deg,#202020_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#202020_75%)] border border-black/10 overflow-hidden flex items-center justify-center shrink-0">
                <img 
                  src={resolveImageSrc(getAssetReference(assetToDelete))} 
                  alt={assetToDelete.fileName} 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate" title={assetToDelete.fileName}>
                  {assetToDelete.fileName}
                </div>
                <div className={`text-[11px] mt-0.5 flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  <span>{Math.ceil(assetToDelete.byteLength / 1024)} KB</span>
                  <span>·</span>
                  <span className="uppercase font-mono font-semibold">{getFormatBadge(assetToDelete.mediaType)}</span>
                </div>
              </div>
            </div>

            <div className={`mt-4 text-[11px] px-3 py-2 rounded-lg border ${
              isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              注意：删除后该图片数据将立即从存储中清除，此操作不可撤销。未引用的图片也可能存在历史版本中，删除同样会影响这些历史版本。
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAssetToDelete(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                  isDark 
                    ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300' 
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-xs transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>确认删除</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
