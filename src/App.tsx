import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { Editor, type EditorHandle } from './components/Editor';
import { ImageManager } from './components/ImageManager';
import { DocumentHistoryModal } from './components/DocumentHistoryModal';
import { StyleConfigPanel } from './components/StyleConfigPanel';
import { A4Preview, type PreviewNavigationTarget } from './components/A4Preview';
import { JsonThemeModal } from './components/JsonThemeModal';
import { AboutModal } from './components/AboutModal';
import { PrintPdfModal } from './components/PrintPdfModal';
import { ModalDialogContainer } from './components/ModalDialogContainer';
import { modal } from './utils/modalDialog';
import { DocumentAsset, DocumentHistoryEntry, DocumentMeta, DocumentTheme, ThemeMode, ViewMode } from './types';
import { getRegisteredThemes } from './themes/themeRegistry';
import { loadCustomThemes, saveCustomThemes } from './themes/customThemeStore';
import { loadCurrentTheme, saveCurrentTheme } from './themes/currentThemeCache';
import { clearDocumentAssets, clearDocumentChatSessions, listDocumentAssets, listLibraryAssets } from './utils/imageRepository';
import { registerAssetUrls } from './utils/assetUrlRegistry';
import { clearDocumentAssetUrls } from './utils/assetUrlRegistry';
import { isTauriEnvironment, resolveImageSrc, updateTauriWindowTitle } from './utils/tauriHelper';
import { putChatSession, putDocumentAsset, putLibraryAsset } from './utils/imageRepository';
import { collectImageReferences } from './utils/imageReferences';
import { openSangDocument, openSangDocumentByPath, readSangDocumentFile, readStartupDocument } from './utils/documentFileOperations';
import type { SangDocument } from './types';
import { 
  deleteDraftWithAssets, 
  getDraft,
  getUnsavedDraftSummaries,
  clearAllDraftsWithAssets,
  runStorageGC, 
  type DocumentDraftSummary,
} from './utils/draftStore';
import { getRecentDocuments, addRecentDocument, removeRecentDocument, clearRecentDocuments, type RecentDocumentItem } from './utils/recentDocumentsStore';
import { WelcomeDashboard } from './components/WelcomeDashboard';
import { resolveDocumentTemplate, type DocumentTemplateItem } from './data/documentTemplates';
import { DEFAULT_DOCUMENT_META } from './data/defaultDocumentMeta';
import { formatApplicationTitle, resolveDocumentTitle } from './utils/applicationTitle';
import { loadAiConfig, loadAiConfigWithSecrets, saveAiConfig } from './lib/aiConfig';
import { AiConfig } from './types/ai';
import { AiAssistantFloat } from './components/ai/AiAssistantFloat';
import { AiSettingsModal } from './components/ai/AiSettingsModal';
import { AiToolContext } from './utils/aiAssistantService';
import { useDocumentPersistence } from './hooks/useDocumentPersistence';
import { useAiDiffReview } from './hooks/useAiDiffReview';

export default function App() {
  const builtinThemes = getRegisteredThemes();
  const [documentId, setDocumentId] = useState<string>(() => crypto.randomUUID());
  const [documentCreatedAt, setDocumentCreatedAt] = useState(() => new Date().toISOString());
  const [documentPath, setDocumentPath] = useState<string>();
  const [documentSettings, setDocumentSettings] = useState({ historyEnabled: false, historyIdleMinutes: 10 });
  const [isDocumentDirty, setIsDocumentDirty] = useState(false);
  const [history, setHistory] = useState<DocumentHistoryEntry[]>([]);
  const [customThemes, setCustomThemes] = useState<DocumentTheme[]>(loadCustomThemes);

  // AI Assistant State
  const [aiConfig, setAiConfig] = useState<AiConfig>(loadAiConfig);
  const [isAiFloatOpen, setIsAiFloatOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);

  useEffect(() => {
    void loadAiConfigWithSecrets().then(setAiConfig);
  }, []);

  // Welcome Dashboard State
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);
  const [hasActiveDocument, setHasActiveDocument] = useState(false);
  const [unsavedDrafts, setUnsavedDrafts] = useState<DocumentDraftSummary[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<RecentDocumentItem[]>([]);

  // 只从版本化缓存恢复主题 ID；完整文档主题必须来自模板、草稿或 .sdc 的迁移入口。
  const [theme, setTheme] = useState<DocumentTheme>(() => loadCurrentTheme([...builtinThemes, ...customThemes]));
  const [meta, setMeta] = useState<DocumentMeta>(() => structuredClone(DEFAULT_DOCUMENT_META));

  // AI 工具写入后需要立即读回真实值，不能等 React 状态提交（提交是异步的）。
  const themeRef = useRef(theme);
  const metaRef = useRef(meta);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const [markdown, setMarkdown] = useState('');
  const {
    diffReviewSession, handleAcceptHunk, handleRejectHunk, handleAcceptAllHunks,
    handleRejectAllHunks, handleApplyResolution, handleCancelReview, startDiffReview,
  } = useAiDiffReview(markdown, setMarkdown, setIsDocumentDirty);

  // UI Theme Mode: 'system' | 'light' | 'dark' (Default is 'system')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('sangdoccraft_theme_mode');
      if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
      const legacy = localStorage.getItem('sangdoccraft_ui_mode') || localStorage.getItem('docucraft_ui_mode');
      if (legacy === 'light' || legacy === 'dark') return legacy;
    } catch (e) {
      // ignore
    }
    return 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [showImageManager, setShowImageManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showPrintPdfModal, setShowPrintPdfModal] = useState(false);
  const [assets, setAssets] = useState<DocumentAsset[]>([]);
  const [previewNavigationTarget, setPreviewNavigationTarget] = useState<PreviewNavigationTarget>();
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(false);
  const [overflowPageNumbers, setOverflowPageNumbers] = useState<number[]>([]);
  const previewNavigationRequestRef = useRef(0);

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
  const splitterRef = useRef<HTMLDivElement>(null);
  const configPanelRef = useRef<HTMLDivElement>(null);
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
    if (!hasActiveDocument) {
      setAssets([]);
      return;
    }
    void Promise.all([
      refreshAssets(),
      runStorageGC(documentId),
    ]);
  }, [documentId, hasActiveDocument]);

  useEffect(() => {
    let title: string;
    if (isWelcomeOpen) {
      title = formatApplicationTitle(undefined, true);
    } else {
      const docTitle = resolveDocumentTitle({
        themeTitle: meta.title,
        documentPath,
        markdown,
      });
      title = formatApplicationTitle(docTitle, false);
    }

    document.title = title;

    if (isTauriEnvironment()) {
      void updateTauriWindowTitle(title).catch((error) => {
        console.error('Update Tauri window title failed:', error);
      });
    }
  }, [isWelcomeOpen, meta.title, documentPath, markdown]);

  const refreshUnsavedDrafts = async () => {
    try {
      const drafts = await getUnsavedDraftSummaries();
      setUnsavedDrafts(drafts);
    } catch (e) {
      console.error('Failed to load unsaved drafts:', e);
    }
  };

  const { saveStatus, lastSavedAt, handleSaveDocument, handleExportSdc } = useDocumentPersistence({
    documentId, documentCreatedAt, documentPath, documentSettings, isDocumentDirty,
    history, markdown, meta, theme, assets, setDocumentPath, setHistory,
    setIsDocumentDirty, setRecentDocuments, refreshUnsavedDrafts,
  });

  const refreshRecentDocs = () => {
    try {
      setRecentDocuments(getRecentDocuments());
    } catch (e) {
      console.error('Failed to load recent docs:', e);
    }
  };

  const applyOpenedDocument = async (opened: { document: SangDocument; path?: string }) => {
    // 释放当前前端内存中的 Object URL 引用，绝不清空其它草稿文档在 IndexedDB 中的图片资产
    clearDocumentAssetUrls();
    for (const asset of opened.document.assets) {
      if (asset.scope === 'library') await putLibraryAsset(asset);
      else await putDocumentAsset(opened.document.id, asset);
    }
    await clearDocumentChatSessions(opened.document.id);
    await Promise.all(opened.document.chatSessions.map(putChatSession));
    setDocumentId(opened.document.id);
    setDocumentCreatedAt(opened.document.createdAt);
    setDocumentPath(opened.path);
    setDocumentSettings(opened.document.settings);
    setHistory(opened.document.history);
    setMarkdown(opened.document.markdown);
    setMeta(opened.document.meta);
    setTheme(opened.document.theme);
    setIsDocumentDirty(false);
    setHasActiveDocument(true);
    setIsWelcomeOpen(false);
    if (opened.path) {
      const updated = addRecentDocument({
        title: opened.document.title || opened.document.meta.title || '未命名文档',
        path: opened.path,
      });
      setRecentDocuments(updated);
    }
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
        // Load unsaved drafts and recent documents for the Welcome Dashboard
        await refreshUnsavedDrafts();
        refreshRecentDocs();
        // Welcome Dashboard is open by default on startup
        setIsWelcomeOpen(true);
      } catch (error) {
        console.error('Startup initialization failed:', error);
      }
    })();
  }, []);

  // 当前主题缓存只保存稳定 ID，不持久化会随版本演进的完整主题结构。
  useEffect(() => {
    try {
      saveCurrentTheme(theme.id);
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    saveCustomThemes(customThemes);
  }, [customThemes]);

  useEffect(() => {
    try {
      localStorage.setItem('sangdoccraft_theme_mode', themeMode);
    } catch (e) {}
  }, [themeMode]);

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

      const configPanelWidth = configPanelRef.current?.getBoundingClientRect().width ?? 0;
      const splitterWidth = splitterRef.current?.getBoundingClientRect().width ?? 0;
      const previewMinWidth = 240;
      const maxPercentage = ((rect.width - configPanelWidth - splitterWidth - previewMinWidth) / rect.width) * 100;
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

  const handlePresetThemeChange = (selectedTheme: DocumentTheme) => {
    setTheme(structuredClone(selectedTheme));
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

  const handleNewDocument = () => {
    void refreshUnsavedDrafts();
    refreshRecentDocs();
    setIsWelcomeOpen(true);
  };

  const handleSelectTemplate = async (template: DocumentTemplateItem) => {
    if (isDocumentDirty) {
      const ok = await modal.confirm({
        title: '新建确认',
        message: '当前工作区有未保存的修改，选用新模板将覆盖当前内容。是否继续？',
        confirmText: '确认新建',
        cancelText: '取消',
        variant: 'danger',
      });
      if (!ok) return;
    }

    // 释放当前内存中的 Object URL 引用，绝不清理其它草稿在 IndexedDB 中的图片资产
    clearDocumentAssetUrls();

    const allThemes = [...builtinThemes, ...customThemes];
    const matchedTheme = allThemes.find((t) => t.id === template.recommendedThemeId) || builtinThemes[0];

    // 模板只描述差异部分，其余排版与配色完全沿用推荐主题；未在模板中声明的字段保持主题默认值
    const resolved = resolveDocumentTemplate(template, matchedTheme);

    const nextId = crypto.randomUUID();
    const now = new Date().toISOString();
    setDocumentId(nextId);
    setDocumentCreatedAt(now);
    setDocumentPath(undefined);
    setDocumentSettings({ historyEnabled: false, historyIdleMinutes: 10 });
    setHistory([]);
    setMarkdown(template.markdown);
    setMeta(resolved.meta);
    setTheme(resolved.theme);
    setIsDocumentDirty(false);
    setHasActiveDocument(true);
    setIsWelcomeOpen(false);

    const libraryAssets = await listLibraryAssets();
    setAssets(libraryAssets);
    registerAssetUrls(libraryAssets);
  };

  const handleRestoreDraft = async (summary: DocumentDraftSummary) => {
    if (isDocumentDirty && summary.documentId !== documentId) {
      const ok = await modal.confirm({
        title: '恢复草稿确认',
        message: '当前文档有未保存的修改，恢复其他草稿将覆盖当前工作区。是否继续？',
        confirmText: '恢复草稿',
        cancelText: '取消',
        variant: 'primary',
      });
      if (!ok) return;
    }

    const draft = await getDraft(summary.documentId);
    if (!draft) {
      await refreshUnsavedDrafts();
      return;
    }

    // 释放旧文档内存引用，加载目标草稿在 IndexedDB 中的图片资产
    clearDocumentAssetUrls();

    setDocumentId(draft.documentId);
    setDocumentCreatedAt(draft.createdAt);
    setDocumentPath(isTauriEnvironment() ? draft.path : undefined);
    setDocumentSettings(draft.settings);
    setHistory(draft.history);
    setMarkdown(draft.markdown);
    setMeta(draft.meta);
    setTheme(draft.theme);
    setIsDocumentDirty(false);
    setHasActiveDocument(true);
    setIsWelcomeOpen(false);
    await refreshAssets(draft.documentId);
  };

  const handleDeleteDraft = async (targetDocId: string) => {
    const ok = await modal.confirm({
      title: '删除未保存草稿',
      message: '确定要删除此份未保存的草稿吗？删除后草稿内容及其关联的图片资产将一并彻底清理。',
      confirmText: '确认删除',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) return;
    await deleteDraftWithAssets(targetDocId);
    await refreshUnsavedDrafts();
    await runStorageGC(hasActiveDocument ? documentId : undefined);
  };

  const handleClearAllDrafts = async () => {
    const ok = await modal.confirm({
      title: '清空所有草稿',
      message: '确定清空所有未保存的草稿吗？所有草稿及其关联图片资产将被彻底清理，此操作不可逆。',
      confirmText: '全部清空',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) return;
    await clearAllDraftsWithAssets(hasActiveDocument ? documentId : undefined);
    await refreshUnsavedDrafts();
    await runStorageGC(hasActiveDocument ? documentId : undefined);
  };

  const handleOpenRecentPath = async (filePath: string) => {
    if (isDocumentDirty) {
      const ok = await modal.confirm({
        title: '打开文档确认',
        message: '当前文档有未保存的修改，打开历史文档将覆盖当前工作区。是否继续？',
        confirmText: '确认打开',
        cancelText: '取消',
        variant: 'primary',
      });
      if (!ok) return;
    }
    try {
      const opened = await openSangDocumentByPath(filePath);
      if (opened) {
        await applyOpenedDocument(opened);
        const updated = addRecentDocument({
          title: opened.document.title || opened.document.meta.title || '未命名文档',
          path: filePath,
        });
        setRecentDocuments(updated);
        setHasActiveDocument(true);
        setIsWelcomeOpen(false);
      } else {
        await modal.alert({
          title: '文件不存在',
          message: `未找到指定路径的文件：\n${filePath}\n该文件可能已被移动、重命名或删除。`,
          type: 'error',
        });
        const updated = removeRecentDocument(filePath);
        setRecentDocuments(updated);
      }
    } catch (err) {
      await modal.alert({
        title: '打开失败',
        message: err instanceof Error ? err.message : '打开本地文档失败',
        type: 'error',
      });
    }
  };

  const handleRemoveRecent = (filePath: string) => {
    const updated = removeRecentDocument(filePath);
    setRecentDocuments(updated);
  };

  const handleClearRecent = async () => {
    const ok = await modal.confirm({
      title: '清空最近记录',
      message: '确定清空所有最近打开的文件记录吗？（本地文件不会被删除）',
      confirmText: '清空记录',
      cancelText: '取消',
      variant: 'danger',
    });
    if (!ok) return;
    clearRecentDocuments();
    setRecentDocuments([]);
  };

  const handleOpenDocument = async () => {
    if (isDocumentDirty) {
      const ok = await modal.confirm({
        title: '打开文档确认',
        message: '当前文档尚未保存，确定打开其他文档吗？未保存的修改将会丢失。',
        confirmText: '确认打开',
        cancelText: '取消',
        variant: 'danger',
      });
      if (!ok) return;
    }
    try {
      const opened = await openSangDocument();
      if (opened) {
        await applyOpenedDocument(opened);
        setHasActiveDocument(true);
        setIsWelcomeOpen(false);
      } else if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
        documentFileInputRef.current?.click();
      }
    } catch (error) {
      await modal.alert({
        title: '打开文档失败',
        message: error instanceof Error ? error.message : '打开文档失败',
        type: 'error',
      });
    }
  };

  const handleDeleteCustomTheme = (id: string) => {
    setCustomThemes((themes) => themes.filter((item) => item.id !== id));
    if (theme.id === id) handlePresetThemeChange(builtinThemes[0]);
  };

  // Export handlers
  const handleExportDocx = async () => {
    try {
      const { exportToDocx } = await import('./utils/docxExporter');
      await exportToDocx(markdown, meta, theme);
    } catch (err) {
      console.error('Docx export error:', err);
      await modal.alert({
        title: '导出 Word 遇到问题',
        message: '导出 Word 文件遇到问题，请检查文档内容与格式设置。',
        type: 'error',
      });
    }
  };

  const handleExportHtml = async () => {
    try {
      const { exportToHtmlFile } = await import('./utils/htmlExporter');
      await exportToHtmlFile(markdown, meta, theme);
    } catch (err) {
      console.error('HTML export error:', err);
      await modal.alert({
        title: '导出 HTML 遇到问题',
        message: '导出 HTML 文件遇到问题，请重试。',
        type: 'error',
      });
    }
  };

  const effectiveUiMode: 'dark' | 'light' = themeMode === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : themeMode;
  const uiMode = effectiveUiMode;
  const isDark = effectiveUiMode === 'dark';
  const previewTheme = structuredClone(hasActiveDocument ? theme : builtinThemes[0]);
  if (previewTheme.cover.logoUrl) previewTheme.cover.logoUrl = resolveImageSrc(previewTheme.cover.logoUrl);
  if (previewTheme.header.logoUrl) previewTheme.header.logoUrl = resolveImageSrc(previewTheme.header.logoUrl);

  const aiToolContext: AiToolContext = {
    markdown,
    getMeta: () => metaRef.current,
    getTheme: () => themeRef.current,
    settings: documentSettings,
    onUpdateMeta: (update) => {
      const nextMeta = typeof update === 'function' ? update(metaRef.current) : update;
      metaRef.current = nextMeta;
      setMeta(nextMeta);
      setIsDocumentDirty(true);
    },
    onUpdateTheme: (update) => {
      // 同步写回 ref，工具才能立即读回真实主题（校验用它，而不是自己维护的镜像）。
      const nextTheme = typeof update === 'function' ? update(themeRef.current) : update;
      themeRef.current = nextTheme;
      setTheme(nextTheme);
      setIsDocumentDirty(true);
    },
    onUpdateSettings: (update) => {
      setDocumentSettings(update);
    },
    onSetHistory: setHistory,
    onStartDiffReview: startDiffReview,
    onCancelDiffReview: handleCancelReview
  };

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
        onExportDocx={handleExportDocx}
        onExportHtml={handleExportHtml}
        onExportSdc={handleExportSdc}
        overflowPageNumbers={overflowPageNumbers}
        onOpenPrintPdf={() => setShowPrintPdfModal(true)}
        onOpenJsonModal={() => setShowJsonModal(true)}
        onOpenImageManager={() => setShowImageManager(true)}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        effectiveUiMode={effectiveUiMode}
        isDocumentDirty={isDocumentDirty}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onOpenWelcome={() => {
          void refreshUnsavedDrafts();
          refreshRecentDocs();
          setIsWelcomeOpen(true);
        }}
        onNewDocument={handleNewDocument}
        onOpenDocument={() => void handleOpenDocument()}
        onSaveDocument={() => void handleSaveDocument()}
        onOpenHistory={() => setShowHistory(true)}
        onOpenAbout={() => setShowAboutModal(true)}
        onToggleAiAssistant={() => setIsAiFloatOpen(prev => !prev)}
        isAiAssistantOpen={isAiFloatOpen}
      />

      {/* Main Workspace Layout */}
      {hasActiveDocument && (
        <div
          ref={mainWorkspaceRef}
          className={`flex-1 flex overflow-hidden relative ${isDragging ? 'select-none cursor-col-resize' : ''}`}
        >
        
        {/* Left Column: Editor (Visible in 'split' and 'edit' mode) */}
        {(viewMode === 'split' || viewMode === 'edit') && (
          <div 
            style={{
              width: viewMode === 'split' ? `${splitRatio}%` : '100%',
              minWidth: viewMode === 'split' ? '15%' : undefined,
            }}
            className={`h-full flex flex-col border-r ${
              isDark ? 'border-[#2A2A2A] bg-[#181818]' : 'border-slate-200 bg-white'
            }`}
          >
            <Editor
              ref={editorRef}
              value={markdown}
              onChange={handleMarkdownChange}
              onNavigateToPreview={(position) => setPreviewNavigationTarget({
                position,
                requestId: ++previewNavigationRequestRef.current,
              })}
              scrollSyncEnabled={scrollSyncEnabled}
              onScrollSyncEnabledChange={setScrollSyncEnabled}
              onScrollPositionChange={(position) => {
                if (!scrollSyncEnabled) return;
                setPreviewNavigationTarget({
                  position,
                  requestId: ++previewNavigationRequestRef.current,
                  behavior: 'auto',
                });
              }}
              assets={assets}
              uiMode={uiMode}
              documentId={documentId}
              onAssetsChanged={() => refreshAssets()}
              saveStatus={saveStatus === 'saving' ? 'saving' : isDocumentDirty ? 'unsaved' : 'saved'}
              lastSavedAt={lastSavedAt}
              reviewSession={diffReviewSession}
              onAcceptHunk={handleAcceptHunk}
              onRejectHunk={handleRejectHunk}
              onAcceptAllHunks={handleAcceptAllHunks}
              onRejectAllHunks={handleRejectAllHunks}
              onApplyResolution={handleApplyResolution}
              onCancelReview={handleCancelReview}
              onOpenAiAssistant={() => setIsAiFloatOpen(true)}
            />
          </div>
        )}

        {/* Resizable Middle Splitter Handle (Only in 'split' mode) */}
        {viewMode === 'split' && (
          <div
            ref={splitterRef}
            onMouseDown={handleMouseDownSplitter}
            className={`w-1.5 h-full cursor-col-resize select-none shrink-0 z-20 flex items-center justify-center transition-colors group ${
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
            <A4Preview
              markdown={markdown}
              meta={meta}
              theme={previewTheme}
              uiMode={uiMode}
              viewMode={viewMode}
              navigationTarget={previewNavigationTarget}
              onNavigateToEditor={(position) => editorRef.current?.navigateToPosition(position)}
              scrollSyncEnabled={scrollSyncEnabled}
              onScrollPositionChange={(position) => {
                if (scrollSyncEnabled) editorRef.current?.scrollToPosition(position);
              }}
              onOverflowPageNumbersChange={(pageNumbers) => setOverflowPageNumbers((current) => (
                current.length === pageNumbers.length && current.every((pageNumber, index) => pageNumber === pageNumbers[index])
                  ? current
                  : pageNumbers
              ))}
            />
          </div>
        )}

        {/* Far Right Sidebar: Style Configuration Panel */}
        {viewMode !== 'edit' && isConfigPanelOpen && (
          <div ref={configPanelRef} className={`w-[360px] xl:w-[400px] h-full hidden lg:block shrink-0 border-l ${
            isDark ? 'bg-[#181818] border-[#2A2A2A]' : 'bg-white border-slate-200'
          }`}>
            <StyleConfigPanel 
              theme={theme}
              meta={meta}
              assets={assets}
              onChange={(value) => { setTheme(value); setIsDocumentDirty(true); }}
              onMetaChange={(value) => { setMeta(value); setIsDocumentDirty(true); }}
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
      )}

      {/* JSON Theme Import / Export Modal */}
      <DocumentHistoryModal
        isOpen={showHistory}
        isDark={isDark}
        settings={documentSettings}
        history={history}
        currentVersion={meta.version}
        onClose={() => setShowHistory(false)}
        onSettingsChange={(settings) => { setDocumentSettings(settings); setIsDocumentDirty(true); }}
        onRestore={(entry) => { setMarkdown(entry.markdown); setMeta(entry.meta); setTheme(entry.theme); setIsDocumentDirty(true); setShowHistory(false); }}
        onDelete={(entry) => { setHistory((prev) => prev.filter((item) => item.id !== entry.id)); setIsDocumentDirty(true); }}
        onClear={() => { setHistory([]); setIsDocumentDirty(true); }}
      />

      {/* Document File Input for Open */}
      <input
        ref={documentFileInputRef}
        type="file"
        accept=".sdc,application/vnd.sangdoccraft.document+zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void readSangDocumentFile(file)
              .then(applyOpenedDocument)
              .catch((error) => {
                void modal.alert({
                  title: '打开文档失败',
                  message: error instanceof Error ? error.message : '打开文档失败',
                  type: 'error',
                });
              });
          }
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

      {/* About Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        isDark={isDark}
      />

      <PrintPdfModal
        isOpen={showPrintPdfModal}
        onClose={() => setShowPrintPdfModal(false)}
        markdown={markdown}
        meta={meta}
        theme={previewTheme}
        isDark={isDark}
      />

      {/* Word-style Welcome Dashboard / Template Center */}
      <WelcomeDashboard
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
        canClose={hasActiveDocument}
        isDark={isDark}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        isTauri={isTauriEnvironment()}
        onSelectTemplate={handleSelectTemplate}
        onOpenLocalFile={handleOpenDocument}
        onOpenAbout={() => setShowAboutModal(true)}
        drafts={unsavedDrafts}
        onRestoreDraft={handleRestoreDraft}
        onDeleteDraft={handleDeleteDraft}
        onClearAllDrafts={handleClearAllDrafts}
        recentDocuments={recentDocuments}
        onOpenRecentPath={handleOpenRecentPath}
        onRemoveRecent={handleRemoveRecent}
        onClearRecent={handleClearRecent}
      />

      {/* Modal Dialog System (replaces native alert and confirm) */}
      <ModalDialogContainer isDark={isDark} />

      {/* Global Draggable & Expandable AI Assistant Float */}
      <AiAssistantFloat
        isOpen={isAiFloatOpen}
        onClose={() => setIsAiFloatOpen(false)}
        config={aiConfig}
        onConfigChange={(newCfg) => {
          setAiConfig(newCfg);
          void saveAiConfig(newCfg);
        }}
        onOpenSettings={() => setIsAiSettingsOpen(true)}
        toolContext={aiToolContext}
        documentId={documentId}
        isDark={isDark}
      />

      {/* AI Endpoints and Models Settings Modal */}
      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
        config={aiConfig}
        onConfigChange={(newCfg) => {
          setAiConfig(newCfg);
          void saveAiConfig(newCfg);
        }}
        isDark={isDark}
      />

    </div>
  );
}
