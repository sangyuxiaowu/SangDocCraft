import React, { useState, useEffect, useRef } from 'react';
import { Printer, ExternalLink, Download, X, Loader2, Sparkles } from 'lucide-react';
import { DocumentTheme } from '../types';
import { generatePreparedHtml, exportToHtmlFile } from '../utils/htmlExporter';

interface PrintPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  markdown: string;
  theme: DocumentTheme;
  isDark: boolean;
}

export const PrintPdfModal: React.FC<PrintPdfModalProps> = ({
  isOpen,
  onClose,
  markdown,
  theme,
  isDark,
}) => {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    let isCurrent = true;
    setLoading(true);
    setError(null);

    generatePreparedHtml(markdown, theme)
      .then((htmlContent) => {
        if (!isCurrent) return;
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.error('Failed to generate HTML for print:', err);
        setError(err instanceof Error ? err.message : '准备打印页面失败');
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, markdown, theme]);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (e) {
        console.warn('Iframe print failed, opening in new tab instead:', e);
        if (blobUrl) window.open(blobUrl, '_blank');
      }
    } else if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  const handleDownloadHtml = () => {
    void exportToHtmlFile(markdown, theme);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-5xl h-[92vh] rounded-2xl shadow-2xl flex flex-col border overflow-hidden transition-colors ${
          isDark ? 'bg-[#181818] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Modal Top Header */}
        <div className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-3 shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#1e1e1e]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold truncate">打印 / 导出 PDF (独立预览)</h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  A4 独立沙箱渲染
                </span>
              </div>
              <p className={`text-[11px] truncate hidden sm:block ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                基于隔离的 A4 单独页面执行系统打印，自动排版分页，避免工作区边框错位
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              disabled={loading || !blobUrl}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none transition flex items-center gap-1.5 shadow-xs"
              title="调用系统打印，在打印选项中选择「另存为 PDF」即可保存完美排版"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>打印 / 另存为 PDF</span>
            </button>

            <button
              onClick={handleOpenNewTab}
              disabled={loading || !blobUrl}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                isDark
                  ? 'border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200'
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
              title="在新浏览器标签页中打开独立的 HTML 页面"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">新窗口</span>
            </button>

            <button
              onClick={handleDownloadHtml}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                isDark
                  ? 'border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200'
                  : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
              }`}
              title="下载自包含单文件 HTML"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">下载 HTML</span>
            </button>

            <div className={`w-px h-4 mx-0.5 ${isDark ? 'bg-zinc-800' : 'bg-slate-200'}`} />

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg transition ${
                isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Main Area: IFrame Container */}
        <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${
          isDark ? 'bg-[#0f0f0f]' : 'bg-slate-100'
        }`}>
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-center p-6">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
              <div className="text-xs font-medium">正在生成独立 A4 交付文档...</div>
              <div className={`text-[11px] max-w-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                正在转换图表、解析分页并内联所有图片数据
              </div>
            </div>
          ) : error ? (
            <div className="text-center p-6 text-red-500">
              <p className="font-semibold text-sm mb-1">生成预览失败</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          ) : blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              className="w-full h-full border-0 bg-transparent"
              title="A4 独立打印预览"
            />
          ) : null}
        </div>

        {/* Modal Bottom Tip Bar */}
        <div className={`px-4 py-2 border-t text-[11px] flex items-center justify-between shrink-0 ${
          isDark ? 'border-zinc-800 bg-[#161616] text-zinc-400' : 'border-slate-200 bg-slate-50 text-slate-500'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>提示：在浏览器打印面板中，目标打印机选择<strong>「另存为 PDF」</strong>，边距选择<strong>「无」</strong>，并勾选<strong>「背景图形」</strong>，即可获得最佳排版效果。</span>
          </div>
          <span className="font-mono text-[10px] opacity-70 hidden sm:inline">ISO 216 - A4 (210 × 297mm)</span>
        </div>
      </div>
    </div>
  );
};
