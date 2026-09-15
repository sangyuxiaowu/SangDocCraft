import React, { useEffect, useState, useRef } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  HelpCircle, 
  CheckCircle2, 
  X 
} from 'lucide-react';
import { modal, type ModalDialogState } from '../utils/modalDialog';

interface ModalDialogContainerProps {
  isDark: boolean;
}

export const ModalDialogContainer: React.FC<ModalDialogContainerProps> = ({ isDark }) => {
  const [dialog, setDialog] = useState<ModalDialogState | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return modal.subscribe((next) => {
      setDialog(next);
    });
  }, []);

  useEffect(() => {
    if (!dialog) return;

    // Focus primary button when dialog opens
    const focusTimer = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (dialog.mode === 'confirm') {
          dialog.resolve(false);
        } else {
          dialog.resolve(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [dialog]);

  if (!dialog) return null;

  const handleBackdropClick = () => {
    if (dialog.mode === 'confirm') {
      dialog.resolve(false);
    } else {
      dialog.resolve(true);
    }
  };

  const getIcon = () => {
    switch (dialog.variant) {
      case 'danger':
        return (
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case 'info':
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5" />
          </div>
        );
      case 'primary':
      default:
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = () => {
    switch (dialog.variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-500 text-white shadow-xs focus:ring-2 focus:ring-red-500/50';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs focus:ring-2 focus:ring-amber-500/50';
      case 'primary':
      case 'info':
      default:
        return 'bg-blue-600 hover:bg-blue-500 text-white shadow-xs focus:ring-2 focus:ring-blue-500/50';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="modal-dialog-title"
      aria-describedby="modal-dialog-desc"
      onClick={handleBackdropClick}
    >
      <div 
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 p-6 flex flex-col ${
          isDark 
            ? 'bg-[#181818] border-zinc-800 text-zinc-100 shadow-black/60' 
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          {getIcon()}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 id="modal-dialog-title" className="text-base font-bold tracking-tight">
              {dialog.title}
            </h3>
            <div 
              id="modal-dialog-desc" 
              className={`text-xs leading-relaxed mt-1.5 whitespace-pre-line ${
                isDark ? 'text-zinc-300' : 'text-slate-600'
              }`}
            >
              {dialog.message}
            </div>
          </div>
          <button
            type="button"
            onClick={handleBackdropClick}
            className={`p-1 rounded-lg transition -mt-1 -mr-1 ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
            }`}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          {dialog.mode === 'confirm' && (
            <button
              type="button"
              onClick={() => dialog.resolve(false)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition ${
                isDark 
                  ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300' 
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              {dialog.cancelText || '取消'}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => dialog.resolve(true)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${getConfirmButtonClasses()}`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
