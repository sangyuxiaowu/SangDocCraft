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
import { getCoverTemplate } from '../themes/themeRegistry';
import { renderMermaidElements } from '../utils/mermaidRenderer';
import { getTocTitleCss } from '../utils/markdownParser';

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
  const coverTemplate = getCoverTemplate(meta.coverStyle);
  const parsedMarkdown = parseFrontmatter(markdown);
  const isDark = uiMode === 'dark';

  const [zoom, setZoom] = useState<number>(85);
  const [showZoomPresets, setShowZoomPresets] = useState<boolean>(false);
  const [headerLogoSrc, setHeaderLogoSrc] = useState<string>('');
  const [overflowPageCount, setOverflowPageCount] = useState(0);
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrame = 0;
    const scheduleRender = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => void renderMermaidElements(container));
    };
    const observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length > 0)) scheduleRender();
    });

    observer.observe(container, { childList: true, subtree: true });
    scheduleRender();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [markdown, theme, viewMode]);

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

  useEffect(() => {
    const sheets = containerRef.current?.querySelectorAll<HTMLElement>('.a4-sheet-page');
    if (!sheets) return;
    const checkOverflow = () => setOverflowPageCount(Array.from<HTMLElement>(sheets).filter(sheet => sheet.offsetHeight > 1124).length);
    const observer = new ResizeObserver(checkOverflow);
    sheets.forEach((sheet: HTMLElement) => observer.observe(sheet));
    checkOverflow();
    return () => observer.disconnect();
  }, [markdown, theme, totalPages]);

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
            {overflowPageCount > 0 && <span role="status" className="text-xs text-amber-600">{overflowPageCount} 页超出 A4 高度</span>}
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
                ...(page.type === 'content' ? { height: 'auto', minHeight: '297mm', maxHeight: 'none', overflow: 'visible' } : {}),
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
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col" style={page.type === 'content' ? { minHeight: 'auto', overflow: 'visible' } : undefined}>
                
                {/* 1. Cover Page Content */}
                {page.type === 'cover' && (
                  <div className="flex-1 flex flex-col justify-between py-4 h-full">
                    
                    {coverTemplate.renderPreview({ meta, style, coverListItems })}

                  </div>
                )}

                {/* 2. Table of Contents Content */}
                {page.type === 'toc' && (
                  <div className="flex-1 flex flex-col py-4">
                    <h2 
                      className="doc-toc-title text-xl font-bold mb-6 flex items-center justify-between"
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
                    className="markdown-rendered-body flex-1 flow-root"
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
        ${getTocTitleCss('.doc-toc-title', toc, style)}
        ${getMarkdownBodyCss('.markdown-rendered-body', style)}
        .markdown-rendered-body h1 {
          font-family: ${style.headingFonts.h1.fontFamily};
          font-size: ${style.headingFonts.h1.fontSize}px;
          font-weight: ${style.headingFonts.h1.bold ? 700 : 400};
          color: var(--primary-color);
          margin-top: ${style.headingFonts.h1.marginBefore}px;
          margin-bottom: ${style.headingFonts.h1.marginAfter}px;
          padding: ${style.h1Style === 'badge' ? '0.25em 0.5em' : style.h1Style === 'accent-block' ? '0 0 0 0.45em' : '0 0 0.3em'};
          background: ${style.h1Style === 'badge' ? `${style.accentColor}18` : 'transparent'};
          border-bottom: ${style.h1Style === 'underline' ? '2px solid var(--accent-color)' : 'none'};
          border-left: ${style.h1Style === 'accent-block' ? '5px solid var(--accent-color)' : 'none'};
        }
        .markdown-rendered-body h1:first-child {
          margin-top: 0;
        }
        .markdown-rendered-body h2 {
          font-family: ${style.headingFonts.h2.fontFamily};
          font-size: ${style.headingFonts.h2.fontSize}px;
          font-weight: ${style.headingFonts.h2.bold ? 700 : 400};
          color: var(--primary-color);
          margin-top: ${style.headingFonts.h2.marginBefore}px;
          margin-bottom: ${style.headingFonts.h2.marginAfter}px;
          padding-left: ${style.h2Style === 'border-left' ? '8px' : '0'};
          border-left: ${style.h2Style === 'border-left' ? '4px solid var(--accent-color)' : 'none'};
          padding-bottom: ${style.h2Style === 'underline-subtle' ? '0.25em' : '0'};
          border-bottom: ${style.h2Style === 'underline-subtle' ? '1px solid var(--accent-color)' : 'none'};
        }
        .markdown-rendered-body h3 {
          font-family: ${style.headingFonts.h3.fontFamily};
          font-size: ${style.headingFonts.h3.fontSize}px;
          font-weight: ${style.headingFonts.h3.bold ? 700 : 400};
          color: var(--primary-color);
          margin-top: ${style.headingFonts.h3.marginBefore}px;
          margin-bottom: ${style.headingFonts.h3.marginAfter}px;
        }
        .markdown-rendered-body h4 {
          font-family: ${style.headingFonts.h4.fontFamily};
          font-size: ${style.headingFonts.h4.fontSize}px;
          font-weight: ${style.headingFonts.h4.bold ? 700 : 400};
          color: var(--primary-color);
          margin-top: ${style.headingFonts.h4.marginBefore}px;
          margin-bottom: ${style.headingFonts.h4.marginAfter}px;
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
        .markdown-rendered-body .mermaid-error {
          display: block;
          padding: 12px 16px;
          white-space: pre-wrap;
          color: #b91c1c;
          background: #fef2f2;
          border: 1px solid #fecaca;
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
            <span className="font-medium">共 {totalPages} 页</span>
          </div>
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
