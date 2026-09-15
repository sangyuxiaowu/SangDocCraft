import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { Editor, type EditorHandle } from './components/Editor';
import { ImageManager } from './components/ImageManager';
import { DocumentHistoryModal } from './components/DocumentHistoryModal';
import { StyleConfigPanel } from './components/StyleConfigPanel';
import { A4Preview } from './components/A4Preview';
import { JsonThemeModal } from './components/JsonThemeModal';
import { DocumentAsset, DocumentHistoryEntry, DocumentTheme, ViewMode } from './types';
import { getRegisteredThemes } from './themes/themeRegistry';
import { loadCustomThemes, saveCustomThemes } from './themes/customThemeStore';
import { SAMPLE_MARKDOWNS } from './data/defaultMarkdown';
import { listDocumentAssets, listLibraryAssets } from './utils/imageRepository';
import { registerAssetUrls } from './utils/assetUrlRegistry';
import { clearDocumentAssetUrls } from './utils/assetUrlRegistry';
import { resolveImageSrc } from './utils/tauriHelper';
import { clearDocumentAssets, putDocumentAsset, putLibraryAsset } from './utils/imageRepository';
import { collectImageReferences } from './utils/imageReferences';
import { openSangDocument, readSangDocumentFile, readStartupDocument, saveSangDocument } from './utils/documentFileOperations';
import type { SangDocument } from './types';
import { appendUniqueHistory, createHistoryEntry } from './utils/documentHistory';
import { deleteDraft, getLatestDraft, saveDraft } from './utils/draftStore';

export default function App() {
  const builtinThemes = getRegisteredThemes();
  const [documentId, setDocumentId] = useState<string>(() => crypto.randomUUID());
  const [documentCreatedAt, setDocumentCreatedAt] = useState(() => new Date().toISOString());
  const [documentPath, setDocumentPath] = useState<string>();
  const [documentSettings, setDocumentSettings] = useState({ historyEnabled: false, historyIdleMinutes: 10 });
  const [isDocumentDirty, setIsDocumentDirty] = useState(false);
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [customThemes, setCustomThemes] = useState<DocumentTheme[]>(loadCustomThemes);

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
  const [showImageManager, setShowImageManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [assets, setAssets] = useState<DocumentAsset[]>([]);

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
  const editorRef = useRef<EditorHandle>(null);
  const documentFileInputRef = useRef<HTMLInputElement>(null);

  const refreshAssets = async (targetDocumentId = documentId) => {
    const loadedAssets = [
      ...await listDocumentAssets(targetDocumentId),
      ...await listLibraryAssets(),
    ];
    registerAssetUrls(loadedAssets);
    setAssets(loadedAssets);
  };

  useEffect(() => {
    void refreshAssets();
  }, [documentId]);

  const applyOpenedDocument = async (opened: { document: SangDocument; path?: string }) => {
    await clearDocumentAssets(documentId);
    clearDocumentAssetUrls();
    for (const asset of opened.document.assets) {
      if (asset.scope === 'library') await putLibraryAsset(asset);
      else await putDocumentAsset(opened.document.id, asset);
    }
    setDocumentId(opened.document.id);
    setDocumentCreatedAt(opened.document.createdAt);
    setDocumentPath(opened.path);
    setDocumentSettings(opened.document.settings);
    setHistory(opened.document.history);
    setMarkdown(opened.document.markdown);
    setTheme(opened.document.theme);
    setIsDocumentDirty(false);
    await refreshAssets(opened.document.id);
  };

  useEffect(() => {
    void (async () => {
      try {
        const opened = await readStartupDocument();
        if (opened) {
          await applyOpenedDocument(opened);
          return;
        }
        const draft = await getLatestDraft();
        if (draft && confirm('检测到未保存的文档草稿，是否恢复？')) {
          setDocumentId(draft.documentId);
          setDocumentCreatedAt(draft.createdAt);
          setDocumentPath(draft.path);
          setDocumentSettings(draft.settings);
          setHistory(draft.history);
          setMarkdown(draft.markdown);
          setTheme(draft.theme);
          setIsDocumentDirty(true);
          await refreshAssets(draft.documentId);
        }
      } catch (error) {
        console.error('Restore startup document failed:', error);
        alert(error instanceof Error ? error.message : '无法恢复文档');
      }
    })();
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sangdoccraft_current_theme', JSON.stringify(theme));
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    saveCustomThemes(customThemes);
  }, [customThemes]);

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
    setTheme(selectedTheme);
    setIsDocumentDirty(true);
  };

  const handleSaveCustomTheme = async (savedTheme: DocumentTheme, previousId?: string) => {
    let serializedTheme = JSON.stringify(savedTheme);
    for (const reference of collectImageReferences('', savedTheme)) {
      if (!reference.startsWith('@images/')) continue;
      const id = reference.slice('@images/'.length);
      const asset = assets.find((item) => item.scope === 'document' && item.id === id);
      if (!asset) continue;
      const libraryAsset = { ...asset, scope: 'library' as const };
      await putLibraryAsset(libraryAsset);
      registerAssetUrls([libraryAsset]);
      serializedTheme = serializedTheme.replaceAll(reference, `@library/${id}`);
    }
    const persistentTheme = JSON.parse(serializedTheme) as DocumentTheme;
    setCustomThemes((themes) => [
      ...themes.filter((item) => item.id !== (previousId || persistentTheme.id)),
      persistentTheme,
    ]);
    await refreshAssets();
  };

  const handleMarkdownChange = (value: string) => {
    setMarkdown(value);
    setIsDocumentDirty(true);
  };

  const handleNewDocument = async () => {
    if (isDocumentDirty && !confirm('当前文档尚未保存，确定新建文档吗？')) return;
    await clearDocumentAssets(documentId);
    clearDocumentAssetUrls();
    const now = new Date().toISOString();
    const nextId = crypto.randomUUID();
    setDocumentId(nextId);
    setDocumentCreatedAt(now);
    setDocumentPath(undefined);
    setDocumentSettings({ historyEnabled: false, historyIdleMinutes: 10 });
    setHistory([]);
    setMarkdown('# 未命名文档\n\n');
    setTheme(builtinThemes[0]);
    const libraryAssets = await listLibraryAssets();
    setAssets(libraryAssets);
    registerAssetUrls(libraryAssets);
    await deleteDraft(documentId);
    setIsDocumentDirty(false);
  };

  const handleOpenDocument = async () => {
    if (isDocumentDirty && !confirm('当前文档尚未保存，确定打开其他文档吗？')) return;
    try {
      const opened = await openSangDocument();
      if (opened) await applyOpenedDocument(opened);
      else if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) documentFileInputRef.current?.click();
    } catch (error) {
      alert(error instanceof Error ? error.message : '打开文档失败');
    }
  };

  const buildCurrentDocument = (documentHistory = history): SangDocument => {
    const references = collectImageReferences(markdown, theme);
    const packageAssets = assets.filter((asset) => asset.scope === 'document' || references.has(`@library/${asset.id}`));
    return {
      id: documentId,
      title: theme.meta.title.trim() || '未命名文档',
      createdAt: documentCreatedAt,
      modifiedAt: new Date().toISOString(),
      markdown,
      theme,
      settings: documentSettings,
      history: documentHistory,
      assets: packageAssets,
    };
  };

  const handleSaveDocument = async () => {
    try {
      let nextHistory = history;
      if (documentSettings.historyEnabled) {
        nextHistory = appendUniqueHistory(history, await createHistoryEntry(markdown, theme, 'manual'));
        setHistory(nextHistory);
      }
      const savedPath = await saveSangDocument(buildCurrentDocument(nextHistory), documentPath);
      if (!savedPath) return;
      setDocumentPath(savedPath);
      setIsDocumentDirty(false);
      await deleteDraft(documentId);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存文档失败');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isDocumentDirty) return;
      if (documentPath) {
        void saveSangDocument(buildCurrentDocument(), documentPath).then((savedPath) => {
          if (savedPath) {
            setIsDocumentDirty(false);
            void deleteDraft(documentId);
          }
        }).catch((error) => console.error('Auto-save failed:', error));
      } else {
        void saveDraft({
          documentId,
          createdAt: documentCreatedAt,
          updatedAt: new Date().toISOString(),
          path: documentPath,
          markdown,
          theme,
          settings: documentSettings,
          history,
        });
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [documentId, documentCreatedAt, documentPath, documentSettings, markdown, theme, history, assets, isDocumentDirty]);

  useEffect(() => {
    if (!documentSettings.historyEnabled) return;
    const timer = window.setTimeout(() => {
      void createHistoryEntry(markdown, theme, 'idle').then((entry) => {
        const nextHistory = appendUniqueHistory(history, entry);
        setHistory(nextHistory);
        if (documentPath && nextHistory !== history) {
          void saveSangDocument(buildCurrentDocument(nextHistory), documentPath);
        }
      });
    }, documentSettings.historyIdleMinutes * 60_000);
    return () => window.clearTimeout(timer);
  }, [documentSettings.historyEnabled, documentSettings.historyIdleMinutes, markdown, theme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSaveDocument();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentId, documentPath, documentCreatedAt, documentSettings, markdown, theme, assets]);

  const handleDeleteCustomTheme = (id: string) => {
    setCustomThemes((themes) => themes.filter((item) => item.id !== id));
    if (theme.id === id) handlePresetThemeChange(builtinThemes[0]);
  };

  // Export handlers
  const handleExportDocx = async () => {
    try {
      const { exportToDocx } = await import('./utils/docxExporter');
      await exportToDocx(markdown, theme);
    } catch (err) {
      console.error('Docx export error:', err);
      alert('导出 Word 文件遇到问题，请检查文档内容');
    }
  };

  const handleExportHtml = async () => {
    try {
      const { exportToHtmlFile } = await import('./utils/htmlExporter');
      await exportToHtmlFile(markdown, theme);
    } catch (err) {
      console.error('HTML export error:', err);
      alert('导出 HTML 文件遇到问题');
    }
  };

  const isDark = uiMode === 'dark';
  const previewTheme = structuredClone(theme);
  if (previewTheme.meta.logo) previewTheme.meta.logo = resolveImageSrc(previewTheme.meta.logo);
  if (previewTheme.meta.logoUrl) previewTheme.meta.logoUrl = resolveImageSrc(previewTheme.meta.logoUrl);
  if (previewTheme.header.logoUrl) previewTheme.header.logoUrl = resolveImageSrc(previewTheme.header.logoUrl);

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors duration-200 ${
      isDark ? 'dark-ui bg-[#121212] text-white' : 'light-ui bg-slate-100 text-slate-900'
    }`}>
      
      {/* Top Header Controls Bar */}
      <HeaderBar
        currentTheme={theme}
        themes={[...builtinThemes, ...customThemes]}
        customThemeIds={customThemes.map((item) => item.id)}
        onThemeChange={handlePresetThemeChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onMarkdownChange={handleMarkdownChange}
        onExportDocx={handleExportDocx}
        onExportHtml={handleExportHtml}
        onOpenJsonModal={() => setShowJsonModal(true)}
        onOpenImageManager={() => setShowImageManager(true)}
        uiMode={uiMode}
        onToggleUiMode={toggleUiMode}
        documentTitle={theme.meta.title || '未命名文档'}
        isDocumentDirty={isDocumentDirty}
        onNewDocument={() => void handleNewDocument()}
        onOpenDocument={() => void handleOpenDocument()}
        onSaveDocument={() => void handleSaveDocument()}
        onOpenHistory={() => setShowHistory(true)}
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
            <Editor ref={editorRef} value={markdown} onChange={handleMarkdownChange} assets={assets} uiMode={uiMode} />
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
            <A4Preview markdown={markdown} theme={previewTheme} uiMode={uiMode} viewMode={viewMode} />
          </div>
        )}

        {/* Far Right Sidebar: Style Configuration Panel */}
        {viewMode !== 'edit' && isConfigPanelOpen && (
          <div className={`w-[360px] xl:w-[400px] h-full hidden lg:block shrink-0 border-l ${
            isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200'
          }`}>
            <StyleConfigPanel 
              theme={theme} 
              assets={assets}
              onChange={(value) => { setTheme(value); setIsDocumentDirty(true); }}
              uiMode={uiMode}
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
      <DocumentHistoryModal
        isOpen={showHistory}
        isDark={isDark}
        settings={documentSettings}
        history={history}
        onClose={() => setShowHistory(false)}
        onSettingsChange={(settings) => { setDocumentSettings(settings); setIsDocumentDirty(true); }}
        onRestore={(entry) => { setMarkdown(entry.markdown); setTheme(entry.theme); setIsDocumentDirty(true); setShowHistory(false); }}
        onClear={() => { setHistory([]); setIsDocumentDirty(true); }}
      />

      {/* JSON Theme Import / Export Modal */}
      <input
        ref={documentFileInputRef}
        type="file"
        accept=".sdc,application/vnd.sangdoccraft.document+zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readSangDocumentFile(file).then(applyOpenedDocument).catch((error) => alert(error instanceof Error ? error.message : '打开文档失败'));
          event.target.value = '';
        }}
      />

      {/* JSON Theme Import / Export Modal */}
      <ImageManager
        isOpen={showImageManager}
        documentId={documentId}
        assets={assets}
        markdown={markdown}
        theme={theme}
        isDark={isDark}
        onClose={() => setShowImageManager(false)}
        onAssetsChanged={refreshAssets}
        onInsert={(imageMarkdown) => editorRef.current?.insertAtSelection(`\n\n${imageMarkdown}\n\n`)}
        onDocumentContentChange={(nextMarkdown, nextTheme) => {
          setMarkdown(nextMarkdown);
          setTheme(nextTheme);
          setIsDocumentDirty(true);
        }}
      />

      {/* JSON Theme Import / Export Modal */}
      <JsonThemeModal
        isOpen={showJsonModal}
        onClose={() => setShowJsonModal(false)}
        currentTheme={theme}
        builtinThemes={builtinThemes}
        customThemes={customThemes}
        onApplyTheme={handlePresetThemeChange}
        onSaveTheme={handleSaveCustomTheme}
        onDeleteTheme={handleDeleteCustomTheme}
        isDark={isDark}
      />

    </div>
  );
}
