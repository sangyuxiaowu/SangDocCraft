import React, { useState } from 'react';
import { X, Copy, Download, Upload, Check, AlertCircle } from 'lucide-react';
import { DocumentTheme } from '../types';

interface JsonThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: DocumentTheme;
  onApplyTheme: (theme: DocumentTheme) => void;
  isDark?: boolean;
}

export const JsonThemeModal: React.FC<JsonThemeModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onApplyTheme,
  isDark = true,
}) => {
  if (!isOpen) return null;

  const [jsonString, setJsonString] = useState<string>(
    JSON.stringify(currentTheme, null, 2)
  );
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `theme_${currentTheme.id || 'custom'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApplyJson = () => {
    try {
      setErrorMsg('');
      const parsed = JSON.parse(jsonString) as DocumentTheme;
      if (!parsed.meta || !parsed.style) {
        throw new Error('无效的主题 JSON 格式：缺少必要的 meta 或 style 字段');
      }
      onApplyTheme(parsed);
      setSuccessMsg('🎉 主题样式已成功更新应用！');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'JSON 解析错误，请检查语法');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        setJsonString(JSON.stringify(parsed, null, 2));
        setErrorMsg('');
      } catch (err) {
        setErrorMsg('导入的文件不是合法的 JSON 格式');
      }
    };
    reader.readAsText(file);
  };

  // Light/Dark Theme Classes
  const backdropClass = isDark ? 'bg-[#121212]/90' : 'bg-slate-900/40';
  const modalCardClass = isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200 shadow-2xl';
  const headerClass = isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-slate-50 border-slate-200';
  const titleClass = isDark ? 'text-white' : 'text-slate-900';
  const subtitleClass = isDark ? 'text-zinc-500' : 'text-slate-500';
  const closeBtnClass = isDark ? 'text-zinc-400 hover:text-white hover:bg-[#2A2A2A]' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200';
  const bodyClass = isDark ? 'bg-[#181818]' : 'bg-white';
  const textareaClass = isDark
    ? 'bg-[#0A0A0A] text-blue-400 border-[#2A2A2A] focus:border-blue-500'
    : 'bg-slate-50 text-blue-700 border-slate-300 focus:border-blue-500 focus:bg-white';
  const footerClass = isDark ? 'bg-[#0A0A0A] border-[#2A2A2A]' : 'bg-slate-50 border-slate-200';
  const secBtnClass = isDark
    ? 'bg-[#2A2A2A] hover:bg-[#333] text-zinc-200'
    : 'bg-slate-200/80 hover:bg-slate-200 text-slate-700 border border-slate-300/50';
  const cancelBtnClass = isDark
    ? 'text-zinc-400 hover:text-white hover:bg-[#2A2A2A]'
    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60';
  const applyBtnClass = isDark
    ? 'bg-white hover:bg-zinc-200 text-black'
    : 'bg-blue-600 hover:bg-blue-700 text-white shadow';

  return (
    <div className={`fixed inset-0 z-50 backdrop-blur-sm flex items-center justify-center p-4 transition-colors ${backdropClass}`}>
      <div className={`border rounded-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] transition-colors ${modalCardClass}`}>
        
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between transition-colors ${headerClass}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-600/20 text-blue-500 flex items-center justify-center font-mono font-bold text-xs">
              { `{ }` }
            </div>
            <div>
              <h2 className={`text-xs font-black uppercase tracking-widest ${titleClass}`}>主题 JSON 配置分享与导入</h2>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${subtitleClass}`}>导出或黏贴 JSON 代码，快速套用统一设计交付规范</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded transition ${closeBtnClass}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* JSON Textarea Body */}
        <div className={`p-5 flex-1 overflow-y-auto space-y-3 transition-colors ${bodyClass}`}>
          {errorMsg && (
            <div className="p-3 rounded bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-300 text-xs font-mono flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="relative">
            <textarea
              value={jsonString}
              onChange={(e) => setJsonString(e.target.value)}
              className={`w-full h-80 font-mono text-xs p-4 rounded-lg border focus:outline-none leading-relaxed resize-none transition-colors ${textareaClass}`}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Actions Footer */}
        <div className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${footerClass}`}>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${secBtnClass}`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-blue-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制 JSON' : '复制代码'}</span>
            </button>

            <button
              onClick={handleDownloadJson}
              className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider flex items-center gap-1.5 transition ${secBtnClass}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载 .json 文件</span>
            </button>

            <label className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${secBtnClass}`}>
              <Upload className="w-3.5 h-3.5" />
              <span>读取本地 JSON</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-3 py-1.5 rounded font-bold uppercase tracking-wider transition ${cancelBtnClass}`}
            >
              取消
            </button>
            <button
              onClick={handleApplyJson}
              className={`px-4 py-2 rounded font-black uppercase tracking-tighter transition ${applyBtnClass}`}
            >
              应用此 JSON 主题
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
