import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { DocumentAsset, DocumentHistoryEntry, DocumentMeta, DocumentSettings, DocumentTheme, SangDocument } from '../types';
import { modal } from '../utils/modalDialog';
import { listChatSessions } from '../utils/imageRepository';
import { collectImageReferences } from '../utils/imageReferences';
import { downloadSangDocument, saveSangDocument } from '../utils/documentFileOperations';
import { appendUniqueHistory, createHistoryEntry } from '../utils/documentHistory';
import { deleteDraft, saveDraft, markDraftSaved, CURRENT_DRAFT_FORMAT_VERSION } from '../utils/draftStore';
import { addRecentDocument, type RecentDocumentItem } from '../utils/recentDocumentsStore';
import { isTauriEnvironment } from '../utils/tauriHelper';

interface DocumentPersistenceOptions {
  documentId: string;
  documentCreatedAt: string;
  documentPath?: string;
  documentSettings: DocumentSettings;
  isDocumentDirty: boolean;
  history: DocumentHistoryEntry[];
  markdown: string;
  meta: DocumentMeta;
  theme: DocumentTheme;
  assets: DocumentAsset[];
  setDocumentPath: Dispatch<SetStateAction<string | undefined>>;
  setHistory: Dispatch<SetStateAction<DocumentHistoryEntry[]>>;
  setIsDocumentDirty: Dispatch<SetStateAction<boolean>>;
  setRecentDocuments: Dispatch<SetStateAction<RecentDocumentItem[]>>;
  refreshUnsavedDrafts: () => Promise<void>;
}

export function useDocumentPersistence({
  documentId, documentCreatedAt, documentPath, documentSettings, isDocumentDirty,
  history, markdown, meta, theme, assets, setDocumentPath, setHistory,
  setIsDocumentDirty, setRecentDocuments, refreshUnsavedDrafts,
}: DocumentPersistenceOptions) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const currentSaveSnapshotRef = useRef({ documentId, markdown, meta, theme, documentSettings, history, assets });
  currentSaveSnapshotRef.current = { documentId, markdown, meta, theme, documentSettings, history, assets };
  const getSaveSnapshot = (savedHistory = history) => ({ documentId, markdown, meta, theme, documentSettings, history: savedHistory, assets });
  const activeSaveSnapshotRef = useRef<ReturnType<typeof getSaveSnapshot> | null>(null);
  const pendingSaveWriteRef = useRef(Promise.resolve());
  const queueSaveWrite = <T,>(write: () => Promise<T>): Promise<T> => {
    const result = pendingSaveWriteRef.current.then(write, write);
    pendingSaveWriteRef.current = result.then(() => {}, () => {});
    return result;
  };
  const isCurrentSave = (snapshot: ReturnType<typeof getSaveSnapshot>) => {
    const current = currentSaveSnapshotRef.current;
    return current.documentId === snapshot.documentId && current.markdown === snapshot.markdown
      && current.meta === snapshot.meta && current.theme === snapshot.theme
      && current.documentSettings === snapshot.documentSettings && current.history === snapshot.history
      && current.assets === snapshot.assets;
  };
  const finishSave = (snapshot: ReturnType<typeof getSaveSnapshot>) => {
    if (!isCurrentSave(snapshot)) {
      if (activeSaveSnapshotRef.current === snapshot && currentSaveSnapshotRef.current.documentId === snapshot.documentId) {
        setSaveStatus('unsaved');
      }
      return;
    }
    setIsDocumentDirty(false);
    setSaveStatus('saved');
    setLastSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
  };

  useEffect(() => {
    setSaveStatus('saved');
    setLastSavedAt(null);
  }, [documentId]);

  const buildCurrentDocument = async (documentHistory = history): Promise<SangDocument> => {
    const references = collectImageReferences(markdown, theme);
    const packageAssets = assets.filter((asset) => asset.scope === 'document' || references.has(`@library/${asset.id}`));
    return {
      id: documentId,
      title: meta.title.trim() || '未命名文档',
      createdAt: documentCreatedAt,
      modifiedAt: new Date().toISOString(),
      markdown,
      meta,
      theme,
      settings: documentSettings,
      history: documentHistory,
      chatSessions: await listChatSessions(documentId),
      assets: packageAssets,
    };
  };

  const handleSaveDocument = async () => {
    setSaveStatus('saving');
    let snapshot = getSaveSnapshot();
    activeSaveSnapshotRef.current = snapshot;
    try {
      let nextHistory = history;
      if (documentSettings.historyEnabled) {
        nextHistory = appendUniqueHistory(history, await createHistoryEntry(markdown, meta, theme, 'manual'));
        if (!isCurrentSave(snapshot)) {
          finishSave(snapshot);
          return;
        }
        setHistory(nextHistory);
        snapshot = getSaveSnapshot(nextHistory);
        activeSaveSnapshotRef.current = snapshot;
      }
      if (!isTauriEnvironment()) {
        // Web 模式：仅保存内容至本地数据库 (IndexedDB 草稿)，不触发文件下载（导出时才会下载）
        await queueSaveWrite(() => saveDraft({
          formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
          documentId,
          createdAt: documentCreatedAt,
          updatedAt: new Date().toISOString(),
          path: undefined,
          markdown,
          meta,
          theme,
          settings: documentSettings,
          history: nextHistory,
          savedToSdc: false,
        }));
        finishSave(snapshot);
        if (isCurrentSave(snapshot)) await refreshUnsavedDrafts();
        return;
      }
      const savedPath = await queueSaveWrite(async () => saveSangDocument(await buildCurrentDocument(nextHistory), documentPath));
      if (!savedPath) {
        if (isCurrentSave(snapshot)) setSaveStatus(isDocumentDirty ? 'unsaved' : 'saved');
        return;
      }
      if (currentSaveSnapshotRef.current.documentId !== snapshot.documentId) return;
      setDocumentPath(savedPath);
      finishSave(snapshot);
      if (isCurrentSave(snapshot)) await queueSaveWrite(() => deleteDraft(documentId));
      const updated = addRecentDocument({
        title: meta.title || '未命名文档',
        path: savedPath,
      });
      setRecentDocuments(updated);
    } catch (error) {
      if (!isCurrentSave(snapshot)) {
        finishSave(snapshot);
        return;
      }
      setSaveStatus('unsaved');
      await modal.alert({
        title: '保存文档失败',
        message: error instanceof Error ? error.message : '保存文档失败',
        type: 'error',
      });
    }
  };

  const handleExportSdc = async () => {
    const snapshot = getSaveSnapshot();
    try {
      const doc = await buildCurrentDocument();
      downloadSangDocument(doc);
      if (!isTauriEnvironment() && isCurrentSave(snapshot)) {
        // Web 模式：已下载保存为 sdc，无需再保留为未保存草稿
        await queueSaveWrite(() => isCurrentSave(snapshot) ? markDraftSaved(documentId, true) : Promise.resolve());
        if (isCurrentSave(snapshot)) setIsDocumentDirty(false);
        await refreshUnsavedDrafts();
      }
    } catch (error) {
      await modal.alert({
        title: '导出 .sdc 失败',
        message: error instanceof Error ? error.message : '导出失败',
        type: 'error',
      });
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isDocumentDirty) return;
      const snapshot = getSaveSnapshot();
      activeSaveSnapshotRef.current = snapshot;
      setSaveStatus('saving');
      if (isTauriEnvironment() && documentPath) {
        void queueSaveWrite(async () => saveSangDocument(await buildCurrentDocument(), documentPath)).then((savedPath) => {
          if (savedPath) {
            finishSave(snapshot);
            if (isCurrentSave(snapshot)) void queueSaveWrite(() => deleteDraft(documentId));
          }
        }).catch((error) => {
          if (isCurrentSave(snapshot)) setSaveStatus('unsaved');
          else finishSave(snapshot);
          console.error('Auto-save failed:', error);
        });
      } else {
        void queueSaveWrite(() => saveDraft({
          formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
          documentId,
          createdAt: documentCreatedAt,
          updatedAt: new Date().toISOString(),
          path: documentPath,
          markdown,
          meta,
          theme,
          settings: documentSettings,
          history,
          savedToSdc: false,
        })).then(() => {
          finishSave(snapshot);
          if (isCurrentSave(snapshot)) void refreshUnsavedDrafts();
        }).catch((error) => {
          if (isCurrentSave(snapshot)) setSaveStatus('unsaved');
          else finishSave(snapshot);
          console.error('Auto-save failed:', error);
        });
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [documentId, documentCreatedAt, documentPath, documentSettings, markdown, meta, theme, history, assets, isDocumentDirty]);

  useEffect(() => {
    if (!documentSettings.historyEnabled) return;
    const timer = window.setTimeout(() => {
      const snapshot = getSaveSnapshot();
      void createHistoryEntry(markdown, meta, theme, 'idle').then((entry) => {
        if (!isCurrentSave(snapshot)) return;
        const nextHistory = appendUniqueHistory(history, entry);
        setHistory(nextHistory);
        if (isTauriEnvironment() && documentPath && nextHistory !== history) {
          void queueSaveWrite(async () => saveSangDocument(await buildCurrentDocument(nextHistory), documentPath));
        } else if (nextHistory !== history) {
          void queueSaveWrite(() => saveDraft({
            formatVersion: CURRENT_DRAFT_FORMAT_VERSION,
            documentId,
            createdAt: documentCreatedAt,
            updatedAt: new Date().toISOString(),
            markdown,
            meta,
            theme,
            settings: documentSettings,
            history: nextHistory,
          }));
        }
      });
    }, documentSettings.historyIdleMinutes * 60_000);
    return () => window.clearTimeout(timer);
  }, [documentSettings.historyEnabled, documentSettings.historyIdleMinutes, markdown, meta, theme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSaveDocument();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentId, documentPath, documentCreatedAt, documentSettings, markdown, meta, theme, history, assets]);

  return { saveStatus, lastSavedAt, handleSaveDocument, handleExportSdc };
}