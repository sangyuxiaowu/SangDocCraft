import React, { useState } from 'react';
import { Check, Images, X } from 'lucide-react';
import type { DocumentAsset, DocumentAssetScope } from '../types';
import { getAssetReference } from '../utils/assetUrlRegistry';
import { resolveImageSrc } from '../utils/tauriHelper';

interface ImagePickerProps {
  isOpen: boolean;
  assets: DocumentAsset[];
  currentReference?: string;
  isDark: boolean;
  onClose: () => void;
  onSelect: (reference: string) => void;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({
  isOpen,
  assets,
  currentReference,
  isDark,
  onClose,
  onSelect,
}) => {
  const [scope, setScope] = useState<DocumentAssetScope>('document');
  if (!isOpen) return null;

  const visibleAssets = assets.filter((asset) => asset.scope === scope);
  const panelClass = isDark ? 'bg-[#181818] border-[#2A2A2A] text-white' : 'bg-white border-slate-200 text-slate-900';
  const mutedClass = isDark ? 'text-zinc-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-[80] bg-black/65 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="选择图片">
      <div className={`w-full max-w-3xl max-h-[80vh] border rounded-lg shadow-2xl flex flex-col ${panelClass}`}>
        <div className="h-14 px-4 border-b border-inherit flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2"><Images className="w-5 h-5 text-blue-500" /><strong>选择图片</strong></div>
          <button type="button" onClick={onClose} className="p-2 rounded hover:bg-slate-500/15" title="关闭"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-3 border-b border-inherit flex p-1">
          {(['document', 'library'] as const).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setScope(value)}
              className={`px-3 py-1.5 rounded text-xs font-bold ${scope === value ? 'bg-blue-600 text-white' : mutedClass}`}
            >
              {value === 'document' ? '当前文档' : '永久图片库'}
            </button>
          ))}
        </div>
        <div className="overflow-auto p-4 grid content-start grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {visibleAssets.map((asset) => {
            const reference = getAssetReference(asset);
            const selected = reference === currentReference;
            return (
              <button
                type="button"
                key={`${asset.scope}:${asset.id}`}
                onClick={() => onSelect(reference)}
                className={`relative h-40 border rounded-md p-2 text-left ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-inherit hover:border-blue-500/60'}`}
              >
                <img src={resolveImageSrc(reference)} alt={asset.description || asset.fileName} className="w-full h-24 object-contain bg-black/5 rounded" />
                <div className="mt-2 text-xs font-bold truncate">{asset.description || asset.fileName}</div>
                <div className={`text-[10px] truncate ${mutedClass}`}>{asset.fileName}</div>
                {selected && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
              </button>
            );
          })}
          {visibleAssets.length === 0 && <div className={`col-span-full py-14 text-center text-sm ${mutedClass}`}>暂无可选图片，请先在图片管理中添加</div>}
        </div>
      </div>
    </div>
  );
};