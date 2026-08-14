import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { Editor } from './components/Editor';
import { StyleConfigPanel } from './components/StyleConfigPanel';
import { A4Preview } from './components/A4Preview';
import { JsonThemeModal } from './components/JsonThemeModal';
import { DocumentTheme, ViewMode } from './types';
import { getRegisteredThemes } from './themes/themeRegistry';
import { SAMPLE_MARKDOWNS } from './data/defaultMarkdown';
import { exportToDocx } from './utils/docxExporter';
import { exportToHtmlFile } from './utils/htmlExporter';
import { getEffectiveMeta, parseFrontmatter, updateMarkdownFrontmatter } from './utils/markdownParser';

export default function App() {
  // Load initial theme from localStorage or fallback to enterprise default
  const [theme, setTheme] = useState<DocumentTheme>(() => {
    try {
      const saved = localStorage.getItem('sangdoccraft_current_theme') || localStorage.getItem('docucraft_current_theme');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return getRegisteredThemes()[0];
  });

  // Load initial markdown from localStorage or fallback to sample
  const [markdown, setMarkdown] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('sangdoccraft_markdown') || localStorage.getItem('docucraft_markdown');
      if (saved) return saved;
    } catch (e) {
      // ignore
    }
    return SAMPLE_MARKDOWNS.architectureDoc;
  });

  // UI Theme Mode (Dark / Light)
  const [uiMode, setUiMode] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('sangdoccraft_ui_mode') || localStorage.getItem('docucraft_ui_mode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
      // ignore
    }
    return 'dark';
  });

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);

  // Split View ratio state (%)
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sangdoccraft_split_ratio') || localStorage.getItem('docucraft_split_ratio');
      if (saved) return parseFloat(saved);
    } catch (e) {}
    return 42;
  });

  // Collapsible Style Config Panel state
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sangdoccraft_config_panel_open') || localStorage.getItem('docucraft_config_panel_open');
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return true;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const mainWorkspaceRef = useRef<HTMLDivElement>(null);

  // Sync frontmatter from markdown text into theme.meta when markdown changes
  useEffect(() => {
    const { extractedMeta } = parseFrontmatter(markdown);
    if (extractedMeta && Object.keys(extractedMeta).length > 0) {
      setTheme((prev) => {
        let changed = false;
        const newMeta = { ...prev.meta };
        for (const [key, val] of Object.entries(extractedMeta)) {
          if (JSON.stringify(newMeta[key]) !== JSON.stringify(val)) {
            newMeta[key] = val;
            changed = true;
          }
        }
        if (changed) {
          return { ...prev, meta: newMeta };
        }
        return prev;
      });
    }
  }, [markdown]);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sangdoccraft_current_theme', JSON.stringify(theme));
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem('sangdoccraft_markdown', markdown);
    } catch (e) {}
  }, [markdown]);

  useEffect(() => {
    try {
      localStorage.setItem('sangdoccraft_ui_mode', uiMode);
    } catch (e) {}
  }, [uiMode]);

  useEffect(() => {
    try {
      localStorage.setItem('sangdoccraft_split_ratio', splitRatio.toString());
    } catch (e) {}
  }, [splitRatio]);

  useEffect(() => {
    try {
      localStorage.setItem('sangdoccraft_config_panel_open', isConfigPanelOpen.toString());
    } catch (e) {}
  }, [isConfigPanelOpen]);

  // Handle Dragging Splitter
  const handleMouseDownSplitter = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mainWorkspaceRef.current) return;
      const rect = mainWorkspaceRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const currentX = e.clientX - rect.left;
      let newPercentage = (currentX / rect.width) * 100;

      if (newPercentage < 15) newPercentage = 15;
      
      let configPanelWidthPx = 0;
      if (isConfigPanelOpen && viewMode !== 'edit') {
        configPanelWidthPx = Math.min(400, Math.max(340, rect.width * 0.25));
      }

      const maxPercentage = ((rect.width - configPanelWidthPx - 200) / rect.width) * 100;
      if (newPercentage > maxPercentage) newPercentage = Math.max(15, maxPercentage);

      setSplitRatio(newPercentage);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isConfigPanelOpen, viewMode]);

  const toggleUiMode = () => {
    setUiMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handlePresetThemeChange = (selectedTheme: DocumentTheme) => {
    setMarkdown((currentMarkdown) => {
      const currentMeta = getEffectiveMeta(selectedTheme.meta, currentMarkdown);
      const updatedMeta = {
        ...currentMeta,
        coverStyle: selectedTheme.meta.coverStyle,
      };
      return updateMarkdownFrontmatter(currentMarkdown, updatedMeta);
    });
    setTheme(selectedTheme);
  };

  // Export handlers
  const handleExportDocx = async () => {
    try {
      await exportToDocx(markdown, theme);
    } catch (err) {
      console.error('Docx export error:', err);
      alert('导出 Word 文件遇到问题，请检查文档内容');
    }
  };

  const handleExportHtml = async () => {
    try {
      await exportToHtmlFile(markdown, theme);
    } catch (err) {
      console.error('HTML export error:', err);
      alert('导出 HTML 文件遇到问题');
    }
  };

  const isDark = uiMode === 'dark';

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors duration-200 ${
      isDark ? 'dark-ui bg-[#121212] text-white' : 'light-ui bg-slate-100 text-slate-900'
    }`}>
      
      {/* Top Header Controls Bar */}
      <HeaderBar
        currentTheme={theme}
        onThemeChange={handlePresetThemeChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onMarkdownChange={setMarkdown}
        onExportDocx={handleExportDocx}
        onExportHtml={handleExportHtml}
        onOpenJsonModal={() => setShowJsonModal(true)}
        uiMode={uiMode}
        onToggleUiMode={toggleUiMode}
        isConfigPanelOpen={isConfigPanelOpen}
        onToggleConfigPanel={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
      />

      {/* Main Workspace Layout */}
      <div 
        ref={mainWorkspaceRef}
        className={`flex-1 flex overflow-hidden relative ${isDragging ? 'select-none cursor-col-resize' : ''}`}
      >
        
        {/* Left Column: Editor (Visible in 'split' and 'edit' mode) */}
        {(viewMode === 'split' || viewMode === 'edit') && (
          <div 
            style={{ width: viewMode === 'split' ? `${splitRatio}%` : '100%' }}
            className={`h-full flex flex-col shrink-0 border-r ${
              isDark ? 'border-[#2A2A2A] bg-[#181818]' : 'border-slate-200 bg-white'
            }`}
          >
            <Editor value={markdown} onChange={setMarkdown} uiMode={uiMode} />
          </div>
        )}

        {/* Resizable Middle Splitter Handle (Only in 'split' mode) */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleMouseDownSplitter}
            className={`w-1.5 hover:w-2.5 h-full cursor-col-resize select-none shrink-0 z-20 flex items-center justify-center transition-all group ${
              isDragging
                ? 'bg-blue-600'
                : isDark
                ? 'bg-[#2A2A2A] hover:bg-blue-500/80'
                : 'bg-slate-200 hover:bg-blue-500/80'
            }`}
            title="按住拖拽调节左右栏宽度"
          >
            <div className={`w-0.5 h-8 rounded-full transition-colors ${
              isDragging ? 'bg-white' : 'bg-slate-400/50 group-hover:bg-white'
            }`} />
          </div>
        )}

        {/* Center / Right Column: A4 Live Preview (Visible in 'split' and 'preview' mode) */}
        {(viewMode === 'split' || viewMode === 'preview') && (
          <div className={`flex-1 min-w-[240px] h-full flex flex-col overflow-hidden ${
            isDark ? 'bg-[#1E1E1E]' : 'bg-slate-200/80'
          }`}>
            <A4Preview markdown={markdown} theme={theme} uiMode={uiMode} viewMode={viewMode} />
          </div>
        )}

        {/* Far Right Sidebar: Style Configuration Panel */}
        {viewMode !== 'edit' && isConfigPanelOpen && (
          <div className={`w-[360px] xl:w-[400px] h-full hidden lg:block shrink-0 border-l ${
            isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200'
          }`}>
            <StyleConfigPanel 
              theme={theme} 
              onChange={setTheme} 
              uiMode={uiMode}
              markdown={markdown}
              onMarkdownChange={setMarkdown}
            />
          </div>
        )}

        {/* Side Floating Edge Toggle Handle for Right Config Panel */}
        {viewMode !== 'edit' && (
          <button
            onClick={() => setIsConfigPanelOpen(prev => !prev)}
            className={`hidden lg:flex items-center justify-center absolute top-1/2 -translate-y-1/2 z-30 transition-all ${
              isConfigPanelOpen
                ? 'right-[360px] xl:right-[400px] w-4.5 h-14 rounded-l-lg border-y border-l shadow-md'
                : 'right-0 w-5 h-16 rounded-l-lg border-y border-l shadow-xl'
            } ${
              isDark
                ? 'bg-[#222222] hover:bg-[#2C2C2C] border-[#383838] text-zinc-300 hover:text-white'
                : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600 hover:text-slate-900'
            }`}
            title={isConfigPanelOpen ? "收起设置面板" : "展开设置面板"}
          >
            {isConfigPanelOpen ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}

      </div>

      {/* JSON Theme Import / Export Modal */}
      <JsonThemeModal
        isOpen={showJsonModal}
        onClose={() => setShowJsonModal(false)}
        currentTheme={theme}
        onApplyTheme={setTheme}
        isDark={isDark}
      />

    </div>
  );
}
