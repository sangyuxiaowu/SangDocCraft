import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  ChevronUp, 
  Check 
} from 'lucide-react';
import { DocumentTheme, TocItem, DocumentMeta, ViewMode } from '../types';
import { parseTableOfContents, getEffectiveMeta, parseFrontmatter, getFooterSlots, formatPageNumber, splitContentByPages, getTocChunks, paginateContentByDom, preprocessMarkdownCaptions, postProcessRenderedHtml, getDocumentFontStack, getMarkdownBodyCss, getHeadingText } from '../utils/markdownParser';
import { resolveImageSrc, resolvePreviewImageSrc } from '../utils/tauriHelper';

interface A4PreviewProps {
  markdown: string;
  theme: DocumentTheme;
  uiMode?: 'dark' | 'light';
  viewMode?: ViewMode;
}

interface PageItem {
  type: 'cover' | 'toc' | 'content';
  pageNum: number;
  contentHtml?: string;
  tocChunk?: TocItem[];
  tocChunkIdx?: number;
  totalTocPages?: number;
}

export const A4Preview: React.FC<A4PreviewProps> = ({ markdown, theme, uiMode = 'dark', viewMode = 'split' }) => {
  const { header, footer, toc, style } = theme;
  const meta = getEffectiveMeta(theme.meta, markdown);
  const parsedMarkdown = parseFrontmatter(markdown);
  const isDark = uiMode === 'dark';

  const [zoom, setZoom] = useState<number>(85);
  const [showZoomPresets, setShowZoomPresets] = useState<boolean>(false);
  const [headerLogoSrc, setHeaderLogoSrc] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    resolvePreviewImageSrc(header.logoUrl).then((src) => {
      if (!cancelled) setHeaderLogoSrc(src);
    });
    return () => { cancelled = true; };
  }, [header.logoUrl]);

  // Auto-calculate fit-to-width
  const handleFitWidth = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 64; // subtract padding
    const a4WidthPx = 794; // ~210mm in pixels at 96dpi
    if (containerWidth > 0) {
      const calculatedZoom = Math.floor((containerWidth / a4WidthPx) * 100);
      setZoom(Math.min(150, Math.max(35, calculatedZoom)));
    }
  };

  // Initial auto-fit or on container resize / view mode change
  useEffect(() => {
    handleFitWidth();
  }, [viewMode]);

  // Handle Ctrl/Cmd + Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((prev) => {
        const delta = e.deltaY < 0 ? 5 : -5;
        return Math.min(200, Math.max(30, prev + delta));
      });
    }
  };

  const fontStack = getDocumentFontStack(style);

  // List bullet icon mapping
  const bulletChar = style.bulletStyle === 'square' ? '■' :
                     style.bulletStyle === 'checkmark' ? '✓' :
                     style.bulletStyle === 'arrow' ? '▸' : '•';

  // Split markdown body with real-time DOM overflow measurement
  const bodyText = parsedMarkdown.body || markdown;
  const rawContentPages = paginateContentByDom(bodyText, {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontFamily: fontStack,
    primaryColor: style.primaryColor,
    accentColor: style.accentColor,
    textColor: style.textColor,
    h1PageBreak: style.h1PageBreak,
    headerShow: header.show,
    footerShow: footer.show,
    style,
  });

  // Build TOC page numbers from the same pages rendered below.
  const tocItems: TocItem[] = toc.show
    ? parseTableOfContents(markdown, toc.maxDepth, meta, toc.show, style.h1PageBreak, rawContentPages, toc.headingNumbering)
    : [];

  useEffect(() => {
    const headings = containerRef.current?.querySelectorAll<HTMLElement>('.markdown-rendered-body h1, .markdown-rendered-body h2, .markdown-rendered-body h3, .markdown-rendered-body h4');
    headings?.forEach((heading, index) => {
      const tocItem = tocItems[index];
      if (tocItem) heading.id = tocItem.id;
    });
  }, [markdown, tocItems]);

  // Build Pages Array
  const pages: PageItem[] = [];
  let pageCounter = 1;

  // 1. Cover Page
  if (meta.showCover) {
    pages.push({
      type: 'cover',
      pageNum: pageCounter++,
    });
  }

  // 2. Table of Contents Pages (Auto-paginated across multiple pages if long)
  if (toc.show) {
    const tocChunks = getTocChunks(tocItems);
    tocChunks.forEach((chunk, chunkIdx) => {
      pages.push({
        type: 'toc',
        pageNum: pageCounter++,
        tocChunk: chunk,
        tocChunkIdx: chunkIdx,
        totalTocPages: tocChunks.length,
      });
    });
  }

  // 3. Markdown Content Pages
  const docCounters = { imgCount: 0, tableCount: 0 };
  const headingCounters = [0, 0, 0, 0];
  rawContentPages.forEach((pageMd) => {
    const trimmed = pageMd.trim();
    if (trimmed.length > 0 || rawContentPages.length === 1) {
      const preprocessedMd = preprocessMarkdownCaptions(trimmed || pageMd);
      const rawHtml = marked.parse(preprocessedMd) as string;
      const numberedHtml = rawHtml.replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level: string, attributes: string, content: string) => {
        const prefix = getHeadingText('', Number(level), headingCounters, toc.headingNumbering).trim();
        return `<h${level}${attributes}>${prefix ? `${prefix} ` : ''}${content}</h${level}>`;
      });
      const html = postProcessRenderedHtml(numberedHtml, style, docCounters);
      pages.push({
        type: 'content',
        pageNum: pageCounter++,
        contentHtml: html,
      });
    }
  });

  const totalPages = pages.length;

  // Dynamic cover list items
  const coverListItems = (meta.coverlist && meta.coverlist.length > 0)
    ? meta.coverlist
    : [
        { label: '撰写团队', value: meta.author },
        { label: '所属部门', value: meta.department },
      ].filter(item => !!item.value);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      {/* Scrollable Preview Workspace */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        className={`flex-1 overflow-auto p-4 md:p-8 select-text transition-colors duration-200 relative ${isDark ? 'bg-[#1E1E1E]' : 'bg-slate-200/80'}`}
      >
        <div 
          className="min-w-fit flex flex-col items-center mx-auto pb-16 transition-transform duration-150 origin-top"
          style={{
            zoom: `${zoom / 100}`,
          }}
        >
        
        {/* Top Status Bar */}
        <div className={`w-[210mm] flex items-center justify-between mb-3 select-none print-hide ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              A4 Live Stage Preview
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
              共 {totalPages} 页 A4 文档
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-widest font-mono ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              210 × 297 mm
            </span>
          </div>
        </div>

        {/* Pages Render Loop */}
        {pages.map((page, index) => (
          <React.Fragment key={page.pageNum}>
            
            {/* Visual Page Break Separator */}
            {index > 0 && (
              <div className={`my-5 flex items-center gap-3 font-mono text-[10px] uppercase font-bold tracking-widest w-[210mm] select-none print-hide ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
                <div className={`h-px flex-1 ${isDark ? 'bg-[#333]' : 'bg-slate-300'}`}></div>
                <span className={`px-3 py-1 rounded border flex items-center gap-2 shadow-xs ${isDark ? 'bg-[#121212] border-[#2A2A2A] text-zinc-400' : 'bg-white border-slate-300 text-slate-700'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  A4 分页 — 第 {page.pageNum} 页 / 共 {totalPages} 页
                </span>
                <div className={`h-px flex-1 ${isDark ? 'bg-[#333]' : 'bg-slate-300'}`}></div>
              </div>
            )}

            {/* Individual A4 White Paper Sheet */}
            <div 
              className={`a4-sheet-page w-[210mm] h-[297mm] max-h-[297mm] bg-white text-slate-900 relative my-2 flex flex-col justify-between shrink-0 rounded-sm overflow-hidden transition-all duration-300 ${
                isDark ? 'shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-slate-200'
              }`}
              style={{
                padding: '20mm 15mm',
                fontFamily: fontStack,
                fontSize: `${style.fontSize}px`,
                lineHeight: style.lineHeight,
                color: style.textColor,
              }}
            >
              {header.show && (page.type !== 'cover' || !header.hideOnCover) && headerLogoSrc && (
                <img
                  src={headerLogoSrc}
                  alt="Header Logo"
                  className="absolute left-[75px] z-10 object-contain pointer-events-none"
                  style={{ top: `${header.logoTopOffset ?? 15}px`, height: `${header.logoHeight || 20}px`, width: 'auto', opacity: header.logoOpacity ?? 1 }}
                />
              )}

              {/* Page Header Bar */}
              {header.show && (page.type !== 'cover' || !header.hideOnCover) && (
                <div 
                  className="w-full relative flex items-center justify-between text-[11px] text-slate-500 select-none shrink-0"
                  style={{
                    paddingBottom: '6px',
                    marginBottom: '16px',
                    borderBottom: header.lineStyle === 'none' ? 'none' :
                                  header.lineStyle === 'double' ? `3px double ${style.accentColor}` :
                                  header.lineStyle === 'accent' ? `2px solid ${style.accentColor}` :
                                  `1px solid #cbd5e1`,
                  }}
                >
                  <div className="font-medium text-slate-600 shrink-0" style={{ marginLeft: `${header.leftTextOffset ?? 0}px` }}>
                    <span>{header.leftText || ''}</span>
                  </div>
                  <span className="text-slate-400 truncate px-4 text-center flex-1">{header.centerText || ''}</span>
                  <span className="text-slate-400 truncate">{header.rightText || meta.title || ''}</span>
                </div>
              )}

              {/* Page Main Content Area */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                
                {/* 1. Cover Page Content */}
                {page.type === 'cover' && (
                  <div className="flex-1 flex flex-col justify-between py-4 h-full">
                    
                    {/* STYLE A: Enterprise Blue (🏢 企业经典蓝) */}
                    {(meta.coverStyle === 'enterprise' || !meta.coverStyle) && (
                      <div className="flex-1 flex flex-col justify-between py-6 text-center">
                        {/* Top Organization Badge & Optional Logo */}
                        <div className="pt-2 space-y-2">
                          {(meta.logo || meta.logoUrl) && (
                            <img src={meta.logo || meta.logoUrl} alt="Logo" className="h-10 w-auto object-contain mx-auto mb-2" />
                          )}
                          <span 
                            className="text-xs uppercase tracking-widest font-bold px-4 py-1.5 rounded-full inline-block"
                            style={{
                              color: style.accentColor,
                              backgroundColor: `${style.accentColor}15`,
                              border: `1px solid ${style.accentColor}40`,
                            }}
                          >
                            {meta.organization || '标准交付文档'}
                          </span>
                          {meta.number && (
                            <div className="text-[11px] font-mono font-medium text-slate-400">
                              NO. {meta.number}
                            </div>
                          )}
                        </div>

                        {/* Title & Subtitle */}
                        <div className="space-y-4 max-w-xl mx-auto my-auto py-8">
                          <h1 
                            className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight"
                            style={{ color: style.primaryColor }}
                          >
                            {meta.title || '设计交付文档'}
                          </h1>

                          {meta.subtitle && (
                            <p 
                              className="text-base md:text-lg font-medium"
                              style={{ color: style.accentColor }}
                            >
                              {meta.subtitle}
                            </p>
                          )}

                          <div 
                            className="w-20 h-1 mx-auto my-6 rounded-full"
                            style={{ backgroundColor: style.accentColor }}
                          />
                        </div>

                        {/* Meta Table */}
                        <div className="max-w-md mx-auto w-full text-xs pb-4">
                          <table className="w-full border-collapse">
                            <tbody>
                              {coverListItems.map((item, idx) => (
                                <tr key={idx} className="border-b border-slate-100">
                                  <td className="py-2 pr-3 font-semibold text-right text-slate-500 w-1/3">
                                    {item.label}{item.label.includes(':') || item.label.includes('：') ? '' : '：'}
                                  </td>
                                  <td className="py-2 pl-3 text-left font-medium text-slate-800 w-2/3">
                                    {item.value}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* STYLE B: Modern Tech (💻 科技现代感 - 侧边粗线条条纹 + 左对齐布局) */}
                    {meta.coverStyle === 'modern' && (
                      <div className="flex-1 flex flex-col justify-between py-6 px-4 relative border-l-4" style={{ borderColor: style.accentColor }}>
                        {/* Top Header Badge Row */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-3">
                            {(meta.logo || meta.logoUrl) && (
                              <img src={meta.logo || meta.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                            )}
                            <span 
                              className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded"
                              style={{ color: style.primaryColor, backgroundColor: `${style.primaryColor}15` }}
                            >
                              {meta.organization || 'SPECIFICATION'}
                            </span>
                          </div>
                          {meta.number && (
                            <span 
                              className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full text-white shadow-xs"
                              style={{ backgroundColor: style.accentColor }}
                            >
                              {meta.number}
                            </span>
                          )}
                        </div>

                        {/* Title Block */}
                        <div className="my-auto py-10 space-y-4 pr-4">
                          <h1 
                            className="text-3xl md:text-5xl font-black tracking-tight leading-tight"
                            style={{ color: style.primaryColor }}
                          >
                            {meta.title || '设计交付文档'}
                          </h1>
                          {meta.subtitle && (
                            <p className="text-lg md:text-xl font-semibold opacity-90" style={{ color: style.accentColor }}>
                              {meta.subtitle}
                            </p>
                          )}
                          <div className="w-32 h-1.5 rounded" style={{ backgroundColor: style.accentColor }} />
                        </div>

                        {/* Bottom Left Meta Cards */}
                        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-xs bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                          {coverListItems.map((item, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</div>
                              <div className="font-semibold text-slate-800">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STYLE C: Government Spec (📜 政企规范 - 双边框 + 庄重印章标语) */}
                    {meta.coverStyle === 'spec' && (
                      <div className="flex-1 flex flex-col justify-between p-6 border-2 border-double rounded-sm my-1" style={{ borderColor: style.primaryColor }}>
                        {/* Top Formal Banner */}
                        <div className="text-center border-b pb-3 space-y-1" style={{ borderColor: `${style.primaryColor}30` }}>
                          {(meta.logo || meta.logoUrl) && (
                            <img src={meta.logo || meta.logoUrl} alt="Logo" className="h-8 w-auto object-contain mx-auto mb-1" />
                          )}
                          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: style.primaryColor }}>
                            {meta.organization || '国家与企业标准交付文件'}
                          </div>
                        </div>

                        {/* Main Title Area */}
                        <div className="text-center my-auto py-8 space-y-4">
                          {meta.number && (
                            <div className="text-xs font-mono font-bold px-3 py-1 inline-block rounded bg-slate-100 text-slate-700 border border-slate-200">
                              文档编号：{meta.number}
                            </div>
                          )}
                          <h1 
                            className="text-3xl md:text-4xl font-black tracking-tight"
                            style={{ color: style.primaryColor }}
                          >
                            {meta.title || '规范设计交付文档'}
                          </h1>
                          {meta.subtitle && (
                            <p className="text-base font-bold" style={{ color: style.accentColor }}>
                              {meta.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Formal Metadata Frame */}
                        <div className="border rounded p-4 text-xs bg-slate-50/50" style={{ borderColor: `${style.primaryColor}30` }}>
                          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                            {coverListItems.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="font-bold text-slate-500 shrink-0">{item.label}{item.label.includes(':') || item.label.includes('：') ? '' : '：'}</span>
                                <span className="font-semibold text-slate-900 truncate">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STYLE D: Minimal Clean (🌿 极简黑白 - 高雅留白与纤细排版) */}
                    {meta.coverStyle === 'minimal' && (
                      <div className="flex-1 flex flex-col justify-between py-8 px-4 text-left">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono tracking-widest text-slate-400 uppercase">
                            {meta.organization || 'DOCUMENTATION'}
                          </span>
                          {(meta.logo || meta.logoUrl) && (
                            <img src={meta.logo || meta.logoUrl} alt="Logo" className="h-6 w-auto object-contain opacity-80" />
                          )}
                        </div>

                        <div className="my-auto py-12 space-y-6">
                          {meta.number && (
                            <div className="text-xs font-mono text-slate-400 tracking-wider">
                              NO. {meta.number}
                            </div>
                          )}
                          <h1 
                            className="text-4xl md:text-5xl font-light tracking-tight leading-none"
                            style={{ color: style.primaryColor }}
                          >
                            {meta.title || '设计交付文档'}
                          </h1>
                          {meta.subtitle && (
                            <p className="text-base font-normal text-slate-500 max-w-lg">
                              {meta.subtitle}
                            </p>
                          )}
                          <div className="w-12 h-px bg-slate-300 my-4" />
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600 font-mono border-t pt-4 border-slate-200">
                          {coverListItems.map((item, idx) => (
                            <div key={idx}>
                              <span className="text-slate-400 uppercase">{item.label} /</span> {item.value}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STYLE E: Creative Violet / Gradient (🎨 现代创意 - 渐变卡片横幅) */}
                    {meta.coverStyle === 'creative' && (
                      <div className="flex-1 flex flex-col justify-between py-4">
                        {/* Banner Card */}
                        <div 
                          className="rounded-2xl p-7 text-white shadow-md space-y-3 relative overflow-hidden flex flex-col justify-between"
                          style={{
                            background: `linear-gradient(135deg, ${style.primaryColor}, ${style.accentColor})`,
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs uppercase font-bold tracking-widest opacity-80">
                              {meta.organization || 'CREATIVE SPEC'}
                            </div>
                            {(meta.logo || meta.logoUrl) && (
                              <img src={meta.logo || meta.logoUrl} alt="Logo" className="h-7 w-auto object-contain brightness-0 invert opacity-90" />
                            )}
                          </div>
                          <div>
                            {meta.number && (
                              <div className="text-[10px] font-mono tracking-wider opacity-75 mb-1">
                                NO. {meta.number}
                              </div>
                            )}
                            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
                              {meta.title || '设计交付文档'}
                            </h1>
                            {meta.subtitle && (
                              <p className="text-sm font-medium opacity-90 mt-2">
                                {meta.subtitle}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Modern Grid Cards */}
                        <div className="grid grid-cols-2 gap-3 my-auto py-6">
                          {coverListItems.map((item, idx) => {
                            // Check if label contains emoji
                            const match = item.label.match(/^(\p{Extended_Pictographic}+(?:\uFE0F|\u200D\p{Extended_Pictographic}+)*)\s*(.*)/u);
                            const emoji = match ? match[1] : null;
                            const cleanLabel = match && match[2] ? match[2].trim() : (emoji ? item.label.replace(emoji, '').trim() : item.label);

                            return (
                              <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                                {emoji ? <span className="text-base shrink-0 select-none leading-none flex items-center justify-center">{emoji}</span> : null}
                                <div className="overflow-hidden">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                                    {cleanLabel || item.label}
                                  </div>
                                  <div className="text-xs font-bold text-slate-800 truncate">{item.value}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="text-center text-[10px] font-bold tracking-widest uppercase text-slate-400">
                          DOC CRAFT CREATIVE SPECIFICATION
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* 2. Table of Contents Content */}
                {page.type === 'toc' && (
                  <div className="flex-1 flex flex-col py-4">
                    <h2 
                      className="text-xl font-bold mb-6 pb-2 border-b-2 flex items-center justify-between"
                      style={{
                        color: style.primaryColor,
                        borderColor: style.accentColor,
                      }}
                    >
                      <span>
                        {toc.title || '目 录'}
                        {page.totalTocPages && page.totalTocPages > 1 && (
                          <span className="text-xs font-normal text-slate-500 ml-2">
                            ({(page.tocChunkIdx ?? 0) + 1}/{page.totalTocPages})
                          </span>
                        )}
                      </span>
                    </h2>

                    {(!page.tocChunk || page.tocChunk.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">尚未找到标题，请输入 # 或 ## 创建目录项...</p>
                    ) : (
                      <div className="space-y-3 text-xs flex-1">
                        {page.tocChunk.map((item) => {
                          const indentClass = item.level === 1 ? 'font-bold text-slate-800 text-sm' :
                                              item.level === 2 ? 'pl-4 text-slate-700' : 'pl-8 text-slate-600';
                          
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                              className={`w-full flex items-center justify-between text-left cursor-pointer hover:text-blue-600 ${indentClass}`}
                            >
                              <span className="shrink-0 max-w-[80%]">{item.text}</span>
                              {toc.leaderStyle !== 'none' && (
                                <div 
                                  className="flex-1 mx-2 border-b border-dotted border-slate-300 h-2"
                                  style={{
                                    borderStyle: toc.leaderStyle === 'dashes' ? 'dashed' : toc.leaderStyle === 'line' ? 'solid' : 'dotted',
                                  }}
                                />
                              )}
                              {toc.showPageNumbers && (
                                <span className="text-slate-600 font-mono text-[11px] font-semibold shrink-0">
                                  {item.pageNumber ?? 1}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Markdown Content Page */}
                {page.type === 'content' && page.contentHtml && (
                  <div 
                    className="markdown-rendered-body flex-1 min-h-0 overflow-hidden"
                    style={{
                      '--primary-color': style.primaryColor,
                      '--accent-color': style.accentColor,
                      '--bullet-char': `"${bulletChar}"`,
                    } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: page.contentHtml }}
                  />
                )}

              </div>

              {/* Page Footer Bar */}
              {footer.show && (page.type !== 'cover' || !footer.hideOnCover) && (() => {
                const slots = getFooterSlots(page.pageNum, totalPages, footer, meta);
                return (
                  <div className="w-full flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200 select-none shrink-0" style={{ paddingTop: '6px', marginTop: '16px' }}>
                    <span className="text-left flex-1 min-w-0 truncate">{slots.left}</span>
                    <span className="text-center flex-1 min-w-0 truncate font-mono">{slots.center}</span>
                    <span className="text-right flex-1 min-w-0 truncate font-mono">{slots.right}</span>
                  </div>
                );
              })()}

            </div>

          </React.Fragment>
        ))}

      </div>

      {/* Embedded CSS for Markdown Elements Rendering */}
      <style>{`
        ${getMarkdownBodyCss('.markdown-rendered-body', style)}
        .markdown-rendered-body h1 {
          font-family: ${style.headingFonts?.h1.fontFamily || 'inherit'};
          font-size: ${style.headingFonts?.h1.fontSize || 24}px;
          font-weight: ${style.headingFonts?.h1.bold ?? true ? 700 : 400};
          color: var(--primary-color);
          margin-top: 1.6em;
          margin-bottom: 0.6em;
          padding: ${style.h1Style === 'badge' ? '0.25em 0.5em' : style.h1Style === 'accent-block' ? '0 0 0 0.45em' : '0 0 0.3em'};
          background: ${style.h1Style === 'badge' ? `${style.accentColor}18` : 'transparent'};
          border-bottom: ${style.h1Style === 'underline' ? '2px solid var(--accent-color)' : 'none'};
          border-left: ${style.h1Style === 'accent-block' ? '5px solid var(--accent-color)' : 'none'};
        }
        .markdown-rendered-body h1:first-child {
          margin-top: 0;
        }
        .markdown-rendered-body h2 {
          font-family: ${style.headingFonts?.h2.fontFamily || 'inherit'};
          font-size: ${style.headingFonts?.h2.fontSize || 20}px;
          font-weight: ${style.headingFonts?.h2.bold ?? true ? 700 : 400};
          color: var(--primary-color);
          margin-top: 1.4em;
          margin-bottom: 0.5em;
          padding-left: ${style.h2Style === 'border-left' ? '8px' : '0'};
          border-left: ${style.h2Style === 'border-left' ? '4px solid var(--accent-color)' : 'none'};
          padding-bottom: ${style.h2Style === 'underline-subtle' ? '0.25em' : '0'};
          border-bottom: ${style.h2Style === 'underline-subtle' ? '1px solid var(--accent-color)' : 'none'};
        }
        .markdown-rendered-body h3 {
          font-family: ${style.headingFonts?.h3.fontFamily || 'inherit'};
          font-size: ${style.headingFonts?.h3.fontSize || 17}px;
          font-weight: ${style.headingFonts?.h3.bold ?? true ? 700 : 400};
          color: var(--primary-color);
          margin-top: 1.2em;
          margin-bottom: 0.4em;
        }
        .markdown-rendered-body h4 {
          font-family: ${style.headingFonts?.h4.fontFamily || 'inherit'};
          font-size: ${style.headingFonts?.h4.fontSize || 15}px;
          font-weight: ${style.headingFonts?.h4.bold ?? true ? 700 : 400};
          color: var(--primary-color);
          margin-top: 1em;
          margin-bottom: 0.35em;
        }
        .markdown-rendered-body p {
          margin-bottom: 0.9em;
          line-height: inherit;
          text-indent: ${style.indentParagraph ? '2em' : '0'};
        }
        .markdown-rendered-body p.p-continuation,
        .markdown-rendered-body .p-continuation p,
        .markdown-rendered-body blockquote p,
        .markdown-rendered-body li p,
        .markdown-rendered-body table p {
          text-indent: 0 !important;
        }
        .markdown-rendered-body blockquote {
          border-left: 4px solid var(--accent-color);
          background-color: #f8fafc;
          padding: 10px 16px;
          margin: 1.2em 0;
          border-radius: 0 6px 6px 0;
          color: #475569;
          font-style: italic;
        }
        .markdown-rendered-body pre {
          background-color: ${style.codeTheme === 'light' ? '#f1f5f9' : '#0f172a'};
          color: ${style.codeTheme === 'light' ? '#0f172a' : '#f8fafc'};
          padding: 12px 16px;
          border-radius: 6px;
          overflow-x: auto;
          font-family: Consolas, monospace;
          font-size: 0.85em;
          margin: 1em 0;
        }
        .markdown-rendered-body code {
          background-color: #f1f5f9;
          color: #0f172a;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: Consolas, monospace;
          font-size: 0.88em;
        }
        .markdown-rendered-body pre code {
          background-color: transparent;
          color: inherit;
          padding: 0;
        }
        .markdown-rendered-body ul {
          margin: 0.8em 0;
          padding-left: 20px;
          list-style: none;
        }
        .markdown-rendered-body ul li {
          position: relative;
          padding-left: 14px;
          margin-bottom: 0.3em;
        }
        .markdown-rendered-body ul li::before {
          content: var(--bullet-char);
          position: absolute;
          left: 0;
          color: var(--accent-color);
          font-weight: bold;
        }
        .markdown-rendered-body ol {
          margin: 0.8em 0;
          padding-left: 20px;
          list-style-type: ${style.numberStyle === 'chinese' ? 'cjk-ideographic' : style.numberStyle === 'paren' ? 'none' : 'decimal'};
        }
        .markdown-rendered-body ol li {
          margin-bottom: 0.3em;
        }
        ${style.numberStyle === 'paren' ? `
        .markdown-rendered-body ol { counter-reset: item; }
        .markdown-rendered-body ol li { counter-increment: item; }
        .markdown-rendered-body ol li::before { content: '(' counter(item) ') '; color: var(--accent-color); font-weight: 700; }
        ` : ''}
        .markdown-rendered-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.2em 0;
          font-size: 0.9em;
        }
        .markdown-rendered-body th {
          background-color: var(--primary-color);
          color: #ffffff;
          padding: 8px 12px;
          text-align: left;
          font-weight: 600;
        }
        .markdown-rendered-body td {
          border: 1px solid #e2e8f0;
          padding: 8px 12px;
        }
        .markdown-rendered-body tr:nth-child(even) {
          background-color: ${style.tableStyle === 'striped' ? '#f8fafc' : 'transparent'};
        }
        .markdown-rendered-body hr {
          border: none;
          border-top: 1px solid #cbd5e1;
          margin: 1.8em 0;
        }
        .markdown-rendered-body .doc-image-figure {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 1.2em auto;
        }
        .markdown-rendered-body .doc-image {
          max-width: 100%;
          height: auto;
          display: block;
        }
        .markdown-rendered-body .doc-img-border-none {
          border: none;
        }
        .markdown-rendered-body .doc-img-border-solid {
          border: 1px solid #cbd5e1;
        }
        .markdown-rendered-body .doc-img-border-subtle {
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        .markdown-rendered-body .doc-img-border-shadow {
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          border-radius: 6px;
        }
        .markdown-rendered-body .doc-img-border-card {
          background-color: #f8fafc;
          padding: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }
        .markdown-rendered-body .doc-img-border-rounded {
          border-radius: 12px;
          border: 1px solid #cbd5e1;
        }
        .markdown-rendered-body .doc-image-caption {
          margin-top: 6px;
          font-size: 0.85em;
          color: #64748b;
          font-weight: 600;
          line-height: 1.4;
        }
        .markdown-rendered-body .doc-table-caption {
          margin-top: 4px;
          margin-bottom: 6px;
          font-size: 0.88em;
          color: #475569;
          font-weight: 600;
          line-height: 1.4;
        }
      `}</style>

      </div>{/* End Scrollable Preview Workspace */}

      {/* Docked Word-like Footer Zoom Control Bar */}
      <div className={`h-8 shrink-0 border-t flex items-center justify-between px-3 md:px-4 text-xs select-none z-20 ${
        isDark ? 'bg-[#161616] border-[#2A2A2A] text-zinc-400' : 'bg-slate-100 border-slate-200 text-slate-600'
      }`}>
        {/* Document Stats / Status */}
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-bold tracking-wider hidden sm:inline uppercase">A4 Stage</span>
          </div>
          <span className="text-zinc-500 dark:text-zinc-700">|</span>
          <span className="font-medium">共 {totalPages} 页</span>
          <span className="hidden md:inline text-zinc-500 dark:text-zinc-700">|</span>
          <span className="hidden md:inline text-zinc-400 dark:text-zinc-500">210 × 297 mm</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Fit Width Button */}
          <button
            onClick={handleFitWidth}
            className="p-1 rounded hover:bg-blue-500/10 hover:text-blue-500 transition text-[11px] font-medium flex items-center gap-1"
            title="自适应缩放到合适宽度"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">适合宽度</span>
          </button>

          <div className={`w-px h-3.5 mx-0.5 ${isDark ? 'bg-zinc-800' : 'bg-slate-300'}`} />

          {/* Zoom Out Button */}
          <button
            onClick={() => setZoom(prev => Math.max(30, prev - 10))}
            className="p-1 rounded hover:bg-blue-500/10 hover:text-blue-500 transition"
            title="缩小"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          {/* Zoom Range Slider */}
          <input
            type="range"
            min={30}
            max={200}
            step={5}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-14 sm:w-24 h-1 bg-slate-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />

          {/* Zoom In Button */}
          <button
            onClick={() => setZoom(prev => Math.min(200, prev + 10))}
            className="p-1 rounded hover:bg-blue-500/10 hover:text-blue-500 transition"
            title="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className={`w-px h-3.5 mx-0.5 ${isDark ? 'bg-zinc-800' : 'bg-slate-300'}`} />

          {/* Zoom Percentage Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowZoomPresets(!showZoomPresets)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-blue-500/10 hover:text-blue-500 transition text-[11px] font-mono font-bold"
            >
              <span>{zoom}%</span>
              <ChevronUp className="w-3 h-3 text-slate-400" />
            </button>

            {/* Presets Popup */}
            {showZoomPresets && (
              <div className={`absolute bottom-full right-0 mb-2 w-36 rounded-lg border shadow-2xl py-1 text-xs z-50 ${
                isDark ? 'bg-[#181818] border-[#333] text-zinc-200' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <button
                  onClick={() => { handleFitWidth(); setShowZoomPresets(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between font-medium"
                >
                  <span>适合宽度</span>
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <div className={`my-1 border-t ${isDark ? 'border-[#2A2A2A]' : 'border-slate-100'}`} />
                {[50, 75, 90, 100, 125, 150, 200].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => { setZoom(preset); setShowZoomPresets(false); }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between font-mono ${
                      zoom === preset ? 'text-blue-500 font-bold' : ''
                    }`}
                  >
                    <span>{preset}%</span>
                    {zoom === preset && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>
                ))}
                <div className={`my-1 border-t ${isDark ? 'border-[#2A2A2A]' : 'border-slate-100'}`} />
                <button
                  onClick={() => { setZoom(100); setShowZoomPresets(false); }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between ${
                    isDark ? 'text-zinc-400' : 'text-slate-500'
                  }`}
                >
                  <span>100% 原始大小</span>
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
