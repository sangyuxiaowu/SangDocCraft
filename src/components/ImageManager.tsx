import React, { useRef, useState } from 'react';
import { Clipboard, CloudDownload, ImagePlus, Link, PackagePlus, Trash2, X } from 'lucide-react';
import type { DocumentAsset, DocumentAssetScope, DocumentTheme } from '../types';
import { getAssetReference, registerAssetUrl, unregisterAssetUrl } from '../utils/assetUrlRegistry';
import { compressAssetToWebp } from '../utils/imageCompression';
import { createDocumentAsset } from '../utils/documentPackage';
import { deleteAsset, putDocumentAsset, putLibraryAsset } from '../utils/imageRepository';
import { isImageReferenced } from '../utils/imageReferences';
import { fetchImageBinary, resolveImageSrc } from '../utils/tauriHelper';
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
  const [networkUrl, setNetworkUrl] = useState('');
  const [quality, setQuality] = useState(0.8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const visibleAssets = assets.filter((asset) => asset.scope === scope);
  const selected = visibleAssets.find((asset) => asset.id === selectedId) || visibleAssets[0];
  const referenced = selected ? isImageReferenced(selected.id, selected.scope, markdown, theme) : false;
  const panelClass = isDark ? 'bg-[#181818] border-[#2A2A2A] text-white' : 'bg-white border-slate-200 text-slate-900';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-slate-500';

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

  const collectFiles = (files: FileList | null) => run(async () => {
    for (const file of Array.from(files || [])) {
      if (!file.type.startsWith('image/')) continue;
      const asset = await createDocumentAsset(new Uint8Array(await file.arrayBuffer()), {
        fileName: file.name,
        mediaType: file.type,
        scope,
      });
      await saveAsset(documentId, asset);
      setSelectedId(asset.id);
    }
  });

  const collectNetworkImage = () => run(async () => {
    if (!networkUrl.trim()) return;
    const { data, contentType } = await fetchImageBinary(networkUrl.trim());
    const name = new URL(networkUrl.trim()).pathname.split('/').pop() || 'network-image';
    const asset = await createDocumentAsset(new Uint8Array(data), { fileName: name, mediaType: contentType, scope });
    await saveAsset(documentId, asset);
    setSelectedId(asset.id);
    setNetworkUrl('');
  });

  const collectImagesFromDocument = () => run(async () => {
    const collected = await collectDocumentNetworkImages(markdown, theme);
    if (collected.assets.length === 0) {
      setError('当前正文、封面和页眉中没有可收集的网络图片');
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

  const removeSelected = () => selected && !referenced && run(async () => {
    await deleteAsset(documentId, selected);
    unregisterAssetUrl(getAssetReference(selected));
    setSelectedId('');
  });

  return (
    <div className="fixed inset-0 z-[70] bg-black/65 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="图片管理">
      <div className={`w-full max-w-5xl h-[min(760px,90vh)] border rounded-lg shadow-2xl flex flex-col ${panelClass}`}>
        <div className="h-14 px-4 border-b border-inherit flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2"><ImagePlus className="w-5 h-5 text-blue-500" /><strong>图片管理</strong></div>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-500/15" title="关闭"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-4 py-3 border-b border-inherit flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded bg-black/10">
            {(['document', 'library'] as const).map((value) => (
              <button key={value} onClick={() => { setScope(value); setSelectedId(''); }} className={`px-3 py-1.5 rounded text-xs font-bold ${scope === value ? 'bg-blue-600 text-white' : mutedClass}`}>
                {value === 'document' ? '当前文档' : '永久图片库'}
              </button>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void collectFiles(event.target.files)} />
          <button disabled={busy} onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            <PackagePlus className="w-4 h-4" />批量上传
          </button>
          <button disabled={busy} onClick={() => void collectImagesFromDocument()} className="px-3 py-2 rounded border border-blue-500/50 text-blue-500 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50" title="收集正文、封面和页眉中使用的网络图片">
            <CloudDownload className="w-4 h-4" />收集文档网络图片
          </button>
          <div className="flex flex-1 min-w-[260px]">
            <input value={networkUrl} onChange={(event) => setNetworkUrl(event.target.value)} placeholder="https://..." className="flex-1 min-w-0 rounded-l border px-3 py-2 text-xs bg-transparent border-inherit" />
            <button disabled={busy || !networkUrl.trim()} onClick={() => void collectNetworkImage()} className="px-3 rounded-r bg-slate-600 text-white disabled:opacity-50" title="收集网络图片"><Link className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-rows-[minmax(180px,1fr)_minmax(220px,auto)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-auto p-4 grid content-start grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {visibleAssets.map((asset) => (
              <button key={asset.id} onClick={() => setSelectedId(asset.id)} className={`h-40 border rounded-md p-2 text-left ${selected?.id === asset.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-inherit'}`}>
                <img src={resolveImageSrc(getAssetReference(asset))} alt={asset.description || asset.fileName} className="w-full h-24 object-contain bg-black/5 rounded" />
                <div className="mt-2 text-xs font-bold truncate">{asset.fileName}</div>
                <div className={`text-[10px] ${mutedClass}`}>{Math.ceil(asset.byteLength / 1024)} KB</div>
              </button>
            ))}
            {visibleAssets.length === 0 && <div className={`col-span-full py-16 text-center text-sm ${mutedClass}`}>暂无图片</div>}
          </div>

          <aside className="border-t md:border-t-0 md:border-l border-inherit p-4 flex flex-col gap-4 overflow-auto">
            {selected ? <>
              <img src={resolveImageSrc(getAssetReference(selected))} alt={selected.description || selected.fileName} className="w-full h-40 object-contain bg-black/5 rounded" />
              <div><div className={`text-[10px] font-bold mb-1 ${mutedClass}`}>内部引用</div><code className="text-[10px] break-all">{getAssetReference(selected)}</code></div>
              <label className={`text-[10px] font-bold ${mutedClass}`}>图片描述<input key={selected.id} defaultValue={selected.description} onBlur={(event) => {
                if (event.target.value === selected.description) return;
                void run(() => saveAsset(documentId, { ...selected, description: event.target.value }));
              }} className="mt-1 w-full rounded border border-inherit bg-transparent px-2 py-1.5 text-xs" /></label>
              <label className="text-xs">WebP 质量 <strong>{Math.round(quality * 100)}%</strong><input type="range" min="0.1" max="1" step="0.05" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="w-full mt-2" /></label>
              <button disabled={busy || selected.mediaType === 'image/svg+xml'} onClick={() => void compressSelected()} className="px-3 py-2 rounded border border-inherit text-xs font-bold disabled:opacity-50">生成 WebP 压缩副本</button>
              <button onClick={() => onInsert(`![${selected.description || selected.fileName}](${getAssetReference(selected)})`)} className="px-3 py-2 rounded bg-blue-600 text-white text-xs font-bold">插入正文</button>
              <button onClick={() => void navigator.clipboard.writeText(getAssetReference(selected))} className="px-3 py-2 rounded border border-inherit text-xs font-bold flex justify-center items-center gap-1.5"><Clipboard className="w-3.5 h-3.5" />复制引用</button>
              <button disabled={busy || referenced} onClick={() => void removeSelected()} className="mt-auto px-3 py-2 rounded border border-red-500/40 text-red-500 text-xs font-bold flex justify-center items-center gap-1.5 disabled:opacity-40" title={referenced ? '正文、封面或页眉正在引用此图片' : '删除图片'}><Trash2 className="w-3.5 h-3.5" />{referenced ? '已被引用，无法删除' : '删除图片'}</button>
            </> : <div className={`text-xs ${mutedClass}`}>选择一张图片进行操作</div>}
            {error && <div className="text-xs text-red-500">{error}</div>}
          </aside>
        </div>
      </div>
    </div>
  );
};