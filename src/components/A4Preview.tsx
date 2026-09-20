import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  ChevronUp, 
  Check,
  ListTree,
  X,
  ArrowUpToLine,
  ArrowDownToLine,
  TriangleAlert,
} from 'lucide-react';
import { DocumentTheme, TocItem, ViewMode } from '../types';
import {
  getFooterSlots,
  getHeadingText,
  getTocLeaderStyleObject,
  getTocLevelStyleObject,
  getTocPageNumberStyleObject,
  getTocRowStyleObject,
  getTocTextStyleObject,
  getTocTitleStyleObject,
} from '../utils/documentStructure';
import { parseTableOfContents, extractTocHeadings, assignTocPageNumbers, paginateTocItemsByDom, paginateContentByDom, preprocessMarkdownCaptions, postProcessRenderedHtml, getDocumentFontStack, getMarkdownBodyCss } from '../utils/markdownParser';
import { resolveImageSrc, resolvePreviewImageSrc } from '../utils/tauriHelper';
import { getCoverTemplate } from '../themes/themeRegistry';
import { renderMermaidElements } from '../utils/mermaidRenderer';
import { containsMath, ensureMathLoaded, onMathReady } from '../utils/mathRenderer';
import { getTocTitleCss } from '../utils/markdownParser';
import { WatermarkOverlay } from './WatermarkOverlay';

interface A4PreviewProps {
  markdown: string;
  theme: DocumentTheme;
  uiMode?: 'dark' | 'light';
  viewMode?: ViewMode;
  navigationTarget?: PreviewNavigationTarget;
  onNavigateToEditor?: (position: number) => void;
  scrollSyncEnabled?: boolean;
  onScrollPositionChange?: (position: number) => void;
  onOverflowPageNumbersChange?: (pageNumbers: number[]) => void;
}

export interface PreviewNavigationTarget {
  position: number;
  requestId: number;
  behavior?: ScrollBehavior;
}

export interface PreviewPageLocation {
  pageIndex: number;
  pageProgress: number;
}

const PAGE_BREAK_PATTERN = /<!--\s*pagebreak\s*-->/gi;
const A4_PAGE_HEIGHT_PX = 1124;

export function getOverflowPageNumbers(sheets: Iterable<HTMLElement>): number[] {
  return Array.from(sheets)
    .filter(sheet => sheet.offsetHeight > A4_PAGE_HEIGHT_PX)
    .map(sheet => Number(sheet.dataset.pageNum))
    .filter(Number.isInteger);
}

function getEffectiveSourceLength(source: string): number {
  return source.replace(PAGE_BREAK_PATTERN, '').replace(/\s/g, '').length;
}

export function getMarkdownPositionForPreviewPage(markdown: string, pages: string[], pageIndex: number): number {
  return getMarkdownPositionForPreviewLocation(markdown, pages, pageIndex, 0);
}

export function getMarkdownPositionForPreviewLocation(markdown: string, pages: string[], pageIndex: number, pageProgress: number): number {
  const safePageIndex = Math.min(pages.length - 1, Math.max(0, pageIndex));
  const pageStart = pages
    .slice(0, safePageIndex)
    .reduce((total, page) => total + getEffectiveSourceLength(page), 0);
  const pageLength = getEffectiveSourceLength(pages[safePageIndex] ?? '');
  const targetOffset = pageStart + Math.round(pageLength * Math.min(1, Math.max(0, pageProgress)));
  const source = markdown.replace(PAGE_BREAK_PATTERN, (marker) => ' '.repeat(marker.length));
  let effectiveOffset = 0;

  for (let position = 0; position < source.length; position++) {
    if (/\s/.test(source[position])) continue;
    if (effectiveOffset === targetOffset) return position;
    effectiveOffset++;
  }

  return markdown.length;
}

export function getPreviewPageLocation(markdown: string, pages: string[], position: number): PreviewPageLocation {
  const safePosition = Math.min(markdown.length, Math.max(0, position));
  const targetOffset = getEffectiveSourceLength(markdown.slice(0, safePosition));
  let pageStart = 0;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageLength = getEffectiveSourceLength(pages[pageIndex]);
    const isLastPage = pageIndex === pages.length - 1;
    if (targetOffset < pageStart + pageLength || isLastPage) {
      return {
        pageIndex,
        pageProgress: Math.min(1, Math.max(0, (targetOffset - pageStart) / Math.max(1, pageLength))),
      };
    }
    pageStart += pageLength;
  }

  return { pageIndex: 0, pageProgress: 0 };
}

interface PageItem {
  type: 'cover' | 'toc' | 'content';
  pageNum: number;
  contentHtml?: string;
  tocChunk?: TocItem[];
  tocChunkIdx?: number;
  totalTocPages?: number;
  contentPageIndex?: number;
}

export const RenderedMarkdownPage = React.memo(function RenderedMarkdownPage({
  html,
  primaryColor,
  accentColor,
  bulletChar,
}: {
  html: string;
  primaryColor: string;
  accentColor: string;
  bulletChar: string;
}) {
  return (
    <div
      className="markdown-rendered-body flex-1 flow-root"
      style={{
        '--primary-color': primaryColor,
        '--accent-color': accentColor,
        '--bullet-char': `"${bulletChar}"`,
      } as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export const A4Preview: React.FC<A4PreviewProps> = ({ markdown, theme, uiMode = 'dark', viewMode = 'split', navigationTarget, onNavigateToEditor, scrollSyncEnabled = false, onScrollPositionChange, onOverflowPageNumbersChange }) => {
  const { header, footer, toc, style } = theme;
  const meta = theme.meta;
  const coverTemplate = getCoverTemplate(meta.coverStyle);
  const isDark = uiMode === 'dark';

  const [zoom, setZoom] = useState<number>(85);
  const [showZoomPresets, setShowZoomPresets] = useState<boolean>(false);
  const [headerLogoSrc, setHeaderLogoSrc] = useState<string>('');
  const [overflowPageNumbers, setOverflowPageNumbers] = useState<number[]>([]);
  const [mermaidHeights, setMermaidHeights] = useState<Record<string, number>>({});
  const [, setMathEpoch] = useState(0);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef(0);
  const expectedScrollTopRef = useRef<number | null>(null);

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
  const rawContentPages = paginateContentByDom(markdown, {
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
    mermaidHeights,
  });

  // Build TOC page numbers from the same pages rendered below.
  // 目录分页按真实渲染高度自适应测量，目录页数与正文页码保持同步。
  const tocHeadings = toc.show
    ? extractTocHeadings(rawContentPages, toc.maxDepth, toc.headingNumbering)
    : [];
  const tocChunks = toc.show
    ? paginateTocItemsByDom(tocHeadings, {
        toc,
        style,
        headerShow: header.show,
        footerShow: footer.show,
        fontFamily: fontStack,
        coverPageCount: meta.showCover ? 1 : 0,
        contentPageCount: rawContentPages.length,
      })
    : [];
  const tocPageCount = tocChunks.length;
  const firstContentPageNum = (meta.showCover ? 1 : 0) + (toc.show ? tocPageCount : 0) + 1;

  // 测量得到的是标题项，渲染前需按正文起始页回填页码
  const tocPages: TocItem[][] = tocChunks.map((chunk) => assignTocPageNumbers(chunk, firstContentPageNum));

  // Always compute outline headings regardless of whether printed TOC page is enabled.
  // 大纲页码必须复用真实目录页数，否则文档含 h4 标题时会整体偏移。
  const outlineItems: TocItem[] = parseTableOfContents(
    markdown,
    4,
    meta,
    toc.show,
    style.h1PageBreak,
    rawContentPages,
    toc.headingNumbering,
    toc.show ? tocPageCount : 0
  );

  useEffect(() => {
    const headings = containerRef.current?.querySelectorAll<HTMLElement>('.markdown-rendered-body h1, .markdown-rendered-body h2, .markdown-rendered-body h3, .markdown-rendered-body h4');
    headings?.forEach((heading, index) => {
      const outlineItem = outlineItems[index];
      if (outlineItem) heading.id = outlineItem.id;
    });
  }, [markdown, outlineItems]);

  // Scroll listener to update currently visible page number
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const expectedScrollTop = expectedScrollTopRef.current;
      const suppressScrollSync = expectedScrollTop !== null && Math.abs(container.scrollTop - expectedScrollTop) <= 1;
      if (suppressScrollSync) {
        expectedScrollTopRef.current = null;
      } else {
        expectedScrollTopRef.current = null;
      }
      cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = requestAnimationFrame(() => {
      const pageEls = container.querySelectorAll<HTMLElement>('.a4-sheet-page');
      if (pageEls.length === 0) return;

      const containerRect = container.getBoundingClientRect();
      const probeY = containerRect.top + 120;

      let activeNum = 1;
      for (const el of pageEls) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom >= containerRect.top) {
          const num = Number(el.getAttribute('data-page-num'));
          if (num) activeNum = num;
        }
      }
      setCurrentPage(activeNum);
      if (!suppressScrollSync && scrollSyncEnabled && onScrollPositionChange) {
        const contentPages = container.querySelectorAll<HTMLElement>('[data-content-page-index]');
        const syncProbeY = containerRect.top + container.clientHeight / 3;
        let closestPage: HTMLElement | undefined;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const element of contentPages) {
          const rect = element.getBoundingClientRect();
          const distance = syncProbeY < rect.top ? rect.top - syncProbeY : syncProbeY > rect.bottom ? syncProbeY - rect.bottom : 0;
          if (distance < closestDistance) {
            closestDistance = distance;
            closestPage = element;
          }
        }
        if (closestPage) {
          const body = closestPage.querySelector<HTMLElement>('.markdown-rendered-body');
          const contentPageIndex = Number(closestPage.dataset.contentPageIndex);
          if (body && Number.isInteger(contentPageIndex)) {
            const bodyRect = body.getBoundingClientRect();
            const pageProgress = (syncProbeY - bodyRect.top) / Math.max(1, bodyRect.height);
            onScrollPositionChange(getMarkdownPositionForPreviewLocation(markdown, rawContentPages, contentPageIndex, pageProgress));
          }
        }
      }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [markdown, onScrollPositionChange, rawContentPages, scrollSyncEnabled]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const scrollToPage = (pageNum: number) => {
    const validPage = Math.min(totalPages, Math.max(1, pageNum));
    const targetEl = document.getElementById(`a4-page-${validPage}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(validPage);
      setPageInput(String(validPage));
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrame = 0;
    const scheduleRender = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => void renderMermaidElements(container, (source, height) => {
        if (height <= 0) return;
        const roundedHeight = Math.round(height);
        setMermaidHeights((current) => current[source] === roundedHeight
          ? current
          : { ...current, [source]: roundedHeight });
      }));
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

  // 公式按需加载：未就绪时公式回退为 LaTeX 源码，就绪后触发一次重排以得到正确的分页高度
  useEffect(() => {
    if (!containsMath(markdown)) return;
    let cancelled = false;
    const unsubscribe = onMathReady(() => {
      if (!cancelled) setMathEpoch((epoch) => epoch + 1);
    });
    void ensureMathLoaded().catch((error) => console.warn('公式模块加载失败:', error));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [markdown]);

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
    tocPages.forEach((chunk, chunkIdx) => {
      pages.push({
        type: 'toc',
        pageNum: pageCounter++,
        tocChunk: chunk,
        tocChunkIdx: chunkIdx,
        totalTocPages: tocPages.length,
      });
    });
  }

  // 3. Markdown Content Pages
  const docCounters = { imgCount: 0, tableCount: 0 };
  const headingCounters = [0, 0, 0, 0];
  rawContentPages.forEach((pageMd, contentPageIndex) => {
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
        contentPageIndex,
      });
    }
  });

  const totalPages = pages.length;

  useEffect(() => {
    if (!navigationTarget || rawContentPages.length === 0) return;
    const container = containerRef.current;
    if (!container) return;

    const location = getPreviewPageLocation(markdown, rawContentPages, navigationTarget.position);
    const page = pages.find((item) => item.contentPageIndex === location.pageIndex);
    if (!page) return;

    requestAnimationFrame(() => {
      const body = container.querySelector<HTMLElement>(`#a4-page-${page.pageNum} .markdown-rendered-body`);
      if (!body) return;
      const containerRect = container.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const targetTop = container.scrollTop
        + bodyRect.top - containerRect.top
        + bodyRect.height * location.pageProgress
        - container.clientHeight / 2;
      const nextScrollTop = Math.max(0, targetTop);
      if (navigationTarget.behavior === 'auto') expectedScrollTopRef.current = nextScrollTop;
      container.scrollTo({ top: nextScrollTop, behavior: navigationTarget.behavior ?? 'smooth' });
    });
  }, [navigationTarget]);

  useEffect(() => {
    const sheets = containerRef.current?.querySelectorAll<HTMLElement>('.a4-sheet-page');
    if (!sheets) return;
    const checkOverflow = () => setOverflowPageNumbers(getOverflowPageNumbers(sheets));
    const observer = new ResizeObserver(checkOverflow);
    sheets.forEach((sheet: HTMLElement) => observer.observe(sheet));
    checkOverflow();
    return () => observer.disconnect();
  }, [markdown, theme, totalPages]);

  useEffect(() => {
    onOverflowPageNumbersChange?.(overflowPageNumbers);
  }, [onOverflowPageNumbersChange, overflowPageNumbers]);

  // Dynamic cover list items
  const coverListItems = (meta.coverlist && meta.coverlist.length > 0)
    ? meta.coverlist
    : [
        { label: '撰写团队', value: meta.author },
        { label: '所属部门', value: meta.department },
      ].filter(item => !!item.value);

  return (
    <div className="a4-preview-shell w-full h-full flex flex-col overflow-hidden relative">
      {/* Floating Document Outline (Collapsed by default in top-left) */}
      <div className="absolute top-3 left-3 z-30 flex flex-col items-start select-none print-hide">
        <button
          onClick={() => setIsOutlineOpen(!isOutlineOpen)}
          className={`h-7 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shadow-md backdrop-blur-md transition ${
            isOutlineOpen
              ? 'bg-blue-600 border-blue-500 text-white shadow-blue-500/20'
              : isDark
                ? 'bg-[#181818]/90 border-[#333] text-zinc-300 hover:bg-[#222] hover:text-white'
                : 'bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-slate-200'
          }`}
          title={isOutlineOpen ? '收起文档大纲' : '展开文档大纲'}
        >
          <ListTree className="w-3.5 h-3.5 text-blue-400" />
          <span>文档大纲</span>
          {outlineItems.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              isOutlineOpen
                ? 'bg-white/20 text-white'
                : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-600'
            }`}>
              {outlineItems.length}
            </span>
          )}
        </button>

        {/* Floating Outline Panel */}
        {isOutlineOpen && (
          <div
            className={`mt-2 w-72 max-h-[72vh] rounded-xl border shadow-2xl flex flex-col overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 ${
              isDark
                ? 'bg-[#181818]/95 border-[#333] text-zinc-200 shadow-black/60'
                : 'bg-white/95 border-slate-200 text-slate-800 shadow-xl'
            }`}
          >
            <div className={`px-3 py-2 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'border-[#2A2A2A] bg-[#1a1a1a]/80' : 'border-slate-200 bg-slate-50/80'
            }`}>
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <ListTree className="w-3.5 h-3.5 text-blue-500" />
                <span>章节大纲</span>
                <span className="text-[10px] font-mono opacity-60">({outlineItems.length})</span>
              </div>
              <button
                onClick={() => setIsOutlineOpen(false)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition"
                title="关闭大纲"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-1.5 overflow-y-auto flex-1 space-y-0.5 text-xs">
              {outlineItems.length === 0 ? (
                <div className={`py-6 text-center text-xs ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  正文中暂无标题结构
                  <div className="text-[10px] mt-1 opacity-70">使用 #、##、### 标记各级章节</div>
                </div>
              ) : (
                outlineItems.map((item) => {
                  const paddingClass = item.level === 1 ? 'pl-2 font-bold text-blue-600 dark:text-blue-400' :
                                       item.level === 2 ? 'pl-5 font-semibold text-slate-700 dark:text-zinc-200' :
                                       item.level === 3 ? 'pl-8 font-normal text-slate-600 dark:text-zinc-300' :
                                       'pl-10 font-normal text-slate-500 dark:text-zinc-400 text-[11px]';

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        const el = document.getElementById(item.id);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } else if (item.pageNumber) {
                          scrollToPage(item.pageNumber);
                        }
                      }}
                      className={`w-full text-left py-1.5 pr-2 rounded-md flex items-center justify-between gap-1.5 group transition ${paddingClass} ${
                        isDark ? 'hover:bg-zinc-800/80' : 'hover:bg-blue-50/80'
                      }`}
                      title={`${item.text} (第 ${item.pageNumber} 页)`}
                    >
                      <span className="truncate flex-1">
                        {item.text}
                      </span>
                      <span className={`text-[9px] font-mono px-1 py-0.2 rounded shrink-0 opacity-60 group-hover:opacity-100 ${
                        isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        P.{item.pageNumber}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Preview Workspace */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        className={`flex-1 overflow-auto p-4 md:p-8 select-text transition-colors duration-200 relative ${isDark ? 'bg-[#1E1E1E]' : 'bg-slate-200/80'}`}
      >
        <div
          className={`mx-auto flex flex-col gap-2 mb-3 select-none print-hide ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}
          style={{ width: `${210 * zoom / 100}mm` }}
        >
          <div className="flex items-center justify-between gap-3 min-h-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                A4 Preview
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-widest font-mono">
                共 {totalPages} 页
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest font-mono ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                210 × 297 mm
              </span>
            </div>
          </div>
          {overflowPageNumbers.length > 0 && (
            <div
              role="status"
              className={`flex items-start gap-2 w-full px-3 py-2 rounded-md border text-xs font-semibold ${
                isDark
                  ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                  : 'bg-amber-100 border-amber-400 text-amber-900'
              }`}
            >
              <TriangleAlert className="w-4 h-4 mt-px shrink-0" />
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0">
                <span>{overflowPageNumbers.length} 页内容超出 A4 高度，请检查：</span>
                {overflowPageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => scrollToPage(pageNumber)}
                    className={`font-bold underline underline-offset-2 ${isDark ? 'hover:text-amber-100' : 'hover:text-amber-700'}`}
                    title={`跳转到超高的第 ${pageNumber} 页`}
                  >
                    P{pageNumber}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div 
          className="min-w-fit flex flex-col items-center mx-auto pb-16 transition-transform duration-150 origin-top"
          style={{
            zoom: `${zoom / 100}`,
          }}
        >
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
              id={`a4-page-${page.pageNum}`}
              data-page-num={page.pageNum}
              data-content-page-index={page.contentPageIndex}
              onDoubleClick={!scrollSyncEnabled && page.type === 'content' && page.contentPageIndex !== undefined
                ? () => onNavigateToEditor?.(getMarkdownPositionForPreviewPage(markdown, rawContentPages, page.contentPageIndex!))
                : undefined}
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
              <WatermarkOverlay
                watermark={style.watermark}
                isCover={page.type === 'cover'}
                pageNum={page.pageNum}
              />

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
                  <div className="flex-1 flex flex-col" style={{ paddingTop: '16px', paddingBottom: '16px' }}>
                    {((page.tocChunkIdx ?? 0) === 0 || toc.titleOnEveryPage) && (
                      <h2
                        className="doc-toc-title"
                        style={getTocTitleStyleObject(toc) as React.CSSProperties}
                      >
                        {toc.title || '目 录'}
                        {toc.titleOnEveryPage && page.totalTocPages && page.totalTocPages > 1 && (
                          <span className="text-xs font-normal text-slate-500 ml-2">
                            ({(page.tocChunkIdx ?? 0) + 1}/{page.totalTocPages})
                          </span>
                        )}
                      </h2>
                    )}

                    {(!page.tocChunk || page.tocChunk.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">尚未找到标题，请输入 # 或 ## 创建目录项...</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {page.tocChunk.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            className="hover:text-blue-600"
                            style={{
                              ...(getTocRowStyleObject() as React.CSSProperties),
                              ...(getTocLevelStyleObject(item.level, toc) as React.CSSProperties),
                              paddingTop: 0,
                              paddingRight: 0,
                              paddingBottom: 0,
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              lineHeight: style.lineHeight,
                            }}
                          >
                            <span style={getTocTextStyleObject() as React.CSSProperties}>{item.text}</span>
                            {toc.leaderStyle !== 'none' && (
                              <span style={getTocLeaderStyleObject(toc.leaderStyle) as React.CSSProperties} />
                            )}
                            {toc.showPageNumbers && (
                              <span
                                className="font-mono font-semibold"
                                style={{ ...(getTocPageNumberStyleObject() as React.CSSProperties), color: '#475569', fontSize: '0.9em' }}
                              >
                                {item.pageNumber ?? 1}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Markdown Content Page */}
                {page.type === 'content' && page.contentHtml && (
                  <RenderedMarkdownPage
                    html={page.contentHtml}
                    primaryColor={style.primaryColor}
                    accentColor={style.accentColor}
                    bulletChar={bulletChar}
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
          font-style: ${style.headingFonts.h1.italic ? 'italic' : 'normal'};
          text-decoration: ${style.headingFonts.h1.underline ? 'underline' : 'none'};
          color: var(--primary-color);
          margin-top: ${style.headingFonts.h1.marginBefore}px;
          margin-bottom: ${style.headingFonts.h1.marginAfter}px;
          padding: ${style.h1Style === 'badge' ? '0.25em 0.5em' : style.h1Style === 'accent-block' ? '0 0 0 0.45em' : '0 0 0.3em'};
          background: ${style.h1Style === 'badge' ? `${style.accentColor}18` : 'transparent'};
          border-bottom: ${style.h1Style === 'underline' ? '2px solid var(--accent-color)' : 'none'};
          border-left: ${style.h1Style === 'accent-block' ? '5px solid var(--accent-color)' : 'none'};
          ${style.h1Center ? 'text-align: center;' : ''}
        }
        .markdown-rendered-body h1:first-child {
          margin-top: 0;
        }
        .markdown-rendered-body h2 {
          font-family: ${style.headingFonts.h2.fontFamily};
          font-size: ${style.headingFonts.h2.fontSize}px;
          font-weight: ${style.headingFonts.h2.bold ? 700 : 400};
          font-style: ${style.headingFonts.h2.italic ? 'italic' : 'normal'};
          text-decoration: ${style.headingFonts.h2.underline ? 'underline' : 'none'};
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
          font-style: ${style.headingFonts.h3.italic ? 'italic' : 'normal'};
          text-decoration: ${style.headingFonts.h3.underline ? 'underline' : 'none'};
          color: var(--primary-color);
          margin-top: ${style.headingFonts.h3.marginBefore}px;
          margin-bottom: ${style.headingFonts.h3.marginAfter}px;
        }
        .markdown-rendered-body h4 {
          font-family: ${style.headingFonts.h4.fontFamily};
          font-size: ${style.headingFonts.h4.fontSize}px;
          font-weight: ${style.headingFonts.h4.bold ? 700 : 400};
          font-style: ${style.headingFonts.h4.italic ? 'italic' : 'normal'};
          text-decoration: ${style.headingFonts.h4.underline ? 'underline' : 'none'};
          color: var(--primary-color);
          margin-top: ${style.headingFonts.h4.marginBefore}px;
          margin-bottom: ${style.headingFonts.h4.marginAfter}px;
        }
        .markdown-rendered-body > p {
          margin-top: ${style.paragraphMarginBefore ?? 0}px;
          margin-bottom: ${style.paragraphMarginAfter ?? 6}px;
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
          min-height: 0;
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
      <div className={`a4-preview-footer h-8 shrink-0 border-t flex items-center justify-between gap-2 px-3 md:px-4 text-xs select-none z-20 ${
        isDark ? 'bg-[#161616] border-[#2A2A2A] text-zinc-400' : 'bg-slate-100 border-slate-200 text-slate-600'
      }`}>
        {/* Quick Page Jump & Navigation */}
        <div className="a4-preview-page-nav flex items-center gap-1 text-[11px] font-mono shrink-0">
            {/* Jump to first page */}
            <button
              onClick={() => scrollToPage(1)}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-blue-500/10 hover:text-blue-500 disabled:opacity-30 disabled:pointer-events-none transition"
              title="直达首页 (第 1 页)"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
            </button>

            {/* Quick page jumper input */}
            <div className="flex items-center gap-1 px-1 py-0.5 rounded border border-transparent hover:border-slate-300 dark:hover:border-zinc-700 transition">
              <span className="text-[10px] opacity-70 hidden sm:inline">第</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    scrollToPage(parseInt(pageInput, 10) || 1);
                  }
                }}
                onBlur={() => {
                  scrollToPage(parseInt(pageInput, 10) || 1);
                }}
                className={`w-9 text-center font-bold text-[11px] rounded py-0.5 px-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  isDark ? 'bg-zinc-800 text-zinc-100' : 'bg-white border border-slate-200 text-slate-800'
                }`}
                title="输入页码并按回车跳转"
              />
              <span className="text-[11px] opacity-70">/ {totalPages} 页</span>
            </div>

            {/* Jump to last page */}
            <button
              onClick={() => scrollToPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="p-1 rounded hover:bg-blue-500/10 hover:text-blue-500 disabled:opacity-30 disabled:pointer-events-none transition"
              title={`直达尾页 (第 ${totalPages} 页)`}
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
        </div>

        {/* Zoom Controls */}
        <div className="a4-preview-zoom-controls flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Fit Width Button */}
          <button
            onClick={handleFitWidth}
            className="a4-preview-fit-button p-1 rounded hover:bg-blue-500/10 hover:text-blue-500 transition text-[11px] font-medium flex items-center gap-1"
            title="自适应缩放到合适宽度"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="a4-preview-fit-label hidden sm:inline">适合宽度</span>
          </button>

          <div className={`a4-preview-fit-divider w-px h-3.5 mx-0.5 ${isDark ? 'bg-zinc-800' : 'bg-slate-300'}`} />

          {/* Zoom Out Button */}
          <button
            onClick={() => setZoom(prev => Math.max(30, prev - 10))}
            className="a4-preview-zoom-step p-1 rounded hover:bg-blue-500/10 hover:text-blue-500 transition"
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
            className="a4-preview-zoom-slider w-14 sm:w-24 h-1 bg-slate-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />

          {/* Zoom In Button */}
          <button
            onClick={() => setZoom(prev => Math.min(200, prev + 10))}
            className="a4-preview-zoom-step p-1 rounded hover:bg-blue-500/10 hover:text-blue-500 transition"
            title="放大"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className={`a4-preview-zoom-step-divider w-px h-3.5 mx-0.5 ${isDark ? 'bg-zinc-800' : 'bg-slate-300'}`} />

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
