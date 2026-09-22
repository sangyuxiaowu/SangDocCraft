import React, { useState } from 'react';
import { 
  X, 
  Github, 
  ExternalLink, 
  ShieldCheck, 
  Copy, 
  Check, 
  Sparkles, 
  FileText, 
  Download, 
  Layers, 
  Images,
  Target,
  Heart
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

const GITHUB_REPO_URL = 'https://github.com/sangyuxiaowu/SangDocCraft?wt.mc_id=DT-MVP-5005195';
const LICENSE_TYPE = 'Apache 2.0';

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  isDark,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(GITHUB_REPO_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-dialog-title"
      onClick={onClose}
    >
      <div 
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col ${
          isDark ? 'bg-[#181818] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className={`px-6 pt-6 pb-4 flex items-start justify-between border-b ${
          isDark ? 'border-zinc-800/80 bg-zinc-900/30' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center font-mono font-black text-white text-base shadow-sm ring-2 ring-blue-500/20 shrink-0">
              SDC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="about-dialog-title" className="text-base font-extrabold tracking-tight">
                  SANG<span className="text-blue-500 font-black">DOCCRAFT</span>
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  V{__APP_VERSION__}
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                智能 Markdown 文档排版与 A4 交付规范系统
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'
            }`}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(85vh-120px)]">
          {/* WeChat Sponsor / Reward Code Card */}
          <div className={`p-4 rounded-xl border transition flex flex-col sm:flex-row items-center sm:items-stretch gap-4 ${
            isDark 
              ? 'bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-zinc-900 border-amber-500/25' 
              : 'bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-white border-amber-200/90 shadow-xs'
          }`}>
            {/* QR Code Container with crisp white background */}
            <div className="shrink-0 flex flex-col items-center justify-center gap-1.5">
              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-center">
                <img 
                  src="./reward-code.svg" 
                  alt="微信赞赏码" 
                  className="w-28 h-28 sm:w-32 sm:h-32 object-contain select-none"
                  loading="eager"
                />
              </div>
              <span className={`text-[10px] font-medium flex items-center gap-1 ${
                isDark ? 'text-zinc-400' : 'text-slate-500'
              }`}>
                <span>微信扫一扫赞赏</span>
              </span>
            </div>

            {/* Sponsor Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-center sm:justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      微信赞赏支持
                    </span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium hidden sm:inline-flex items-center gap-1 ${
                    isDark ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-amber-100/70 text-amber-800 border border-amber-200'
                  }`}>
                    开源不易 • 感谢支持
                  </span>
                </div>

                <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
                  SangDocCraft 是一款面向正式交付文档的完全免费、无广告独立开源排版系统。如果这款工具帮助您提高了排版效率或解决了导出难题，欢迎微信扫码赞赏支持作者（桑榆肖物），您的每一份鼓励都是持续打磨体验的最大动力！
                </p>
              </div>

              <div className={`mt-3 pt-2.5 border-t flex flex-wrap items-center justify-center sm:justify-between gap-2 text-[11px] ${
                isDark ? 'border-zinc-800/80 text-zinc-400' : 'border-amber-200/60 text-slate-500'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <span>开发者:</span>
                    <strong className={isDark ? 'text-zinc-200' : 'text-slate-700'}>桑榆肖物</strong>
                  </span>
                  <span>•</span>
                  <span>永久免费开源</span>
                </div>
                <a 
                  href="./reward-code.svg" 
                  download="sangdoccraft-wechat-reward.svg"
                  className={`text-[10px] px-2 py-0.5 rounded transition inline-flex items-center gap-1 ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-amber-100/60 text-slate-500 hover:text-slate-800'
                  }`}
                  title="下载赞赏码原图"
                >
                  <Download className="w-3 h-3" />
                  <span>保存赞赏码</span>
                </a>
              </div>
            </div>
          </div>

          {/* GitHub Repository Card */}
          <div className={`p-4 rounded-xl border transition ${
            isDark 
              ? 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700' 
              : 'bg-slate-50/90 border-slate-200/90 hover:border-slate-300'
          }`}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold uppercase tracking-wider">GitHub 开源项目</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1 ${
                isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                <ShieldCheck className="w-3 h-3" />
                {LICENSE_TYPE}
              </span>
            </div>

            <p className={`text-xs leading-relaxed mb-3 ${isDark ? 'text-zinc-300' : 'text-slate-600'}`}>
              SangDocCraft 是一款面向专业技术文档、设计说明书与学术报告的开源排版工具，欢迎 Star 支持与贡献代码。
            </p>

            <div className={`flex items-center justify-between gap-2 p-2 rounded-lg border font-mono text-xs ${
              isDark ? 'bg-black/40 border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <span className="truncate text-[11px] select-all">
                {GITHUB_REPO_URL}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className={`p-1.5 rounded-md text-xs transition flex items-center gap-1 ${
                    copied 
                      ? 'text-emerald-500 font-semibold' 
                      : isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                  }`}
                  title="复制仓库链接"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{copied ? '已复制' : '复制'}</span>
                </button>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow-xs"
                >
                  <span>访问</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Core Highlights */}
          <div className="space-y-2">
            <h4 className={`text-[11px] font-bold uppercase tracking-wider ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}>
              核心特性
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-900/30 border-zinc-800/80' : 'bg-white border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>A4 分页与排版</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  真实分页模拟、智能段落避头尾与分页防截断。
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-900/30 border-zinc-800/80' : 'bg-white border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>封面与目录系统</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  多款企业级封面模板、页眉页脚与动态层级目录。
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-900/30 border-zinc-800/80' : 'bg-white border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>AI 辅助编辑</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  多端点模型配置、文档级会话记忆与差异审查式改稿。
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-900/30 border-zinc-800/80' : 'bg-white border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Target className="w-3.5 h-3.5 text-sky-500" />
                  <span>智能预览定位</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  编辑与预览双向双击定位、滚动同步与超页高度提醒。
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-900/30 border-zinc-800/80' : 'bg-white border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  <span>多格式高质量导出</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  支持导出 Word (.docx)、自包含 HTML 与 .sdc 格式。
                </p>
              </div>

              <div className={`p-3 rounded-xl border ${
                isDark ? 'bg-zinc-900/30 border-zinc-800/80' : 'bg-white border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-xs mb-1">
                  <Images className="w-3.5 h-3.5 text-rose-500" />
                  <span>图片与资产工坊</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  本地图片持久化管理、WebP 质量压缩与网络图片收集。
                </p>
              </div>
            </div>
          </div>

          {/* License & Attribution Statement */}
          <div className={`pt-3 border-t text-[11px] flex flex-col gap-1.5 ${
            isDark ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-slate-500'
          }`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                开源协议: <strong className={isDark ? 'text-zinc-200' : 'text-slate-800'}>Apache License 2.0</strong>
              </span>
              <span className="flex items-center gap-1 text-[10px]">
                Made with <Heart className="w-3 h-3 text-red-500 fill-red-500 inline" /> by 桑榆肖物
              </span>
            </div>
            <div className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              SangDocCraft 保留著作权，允许在遵守 Apache 2.0 协议条款的前提下自由商用、修改及分发。
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className={`px-6 py-3 border-t flex items-center justify-between ${
          isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-slate-100 bg-slate-50'
        }`}>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs font-semibold flex items-center gap-1.5 transition ${
              isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            <span>GitHub 仓库</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
