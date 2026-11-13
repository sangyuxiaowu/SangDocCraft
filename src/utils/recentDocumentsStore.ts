export interface RecentDocumentItem {
  id: string;
  title: string;
  path?: string;
  fileHandleId?: string;
  fileName?: string;
  lastOpenedAt: string;
  size?: number;
}

const STORAGE_KEY = 'sangdoccraft_recent_documents';
const MAX_RECENT_COUNT = 30;

export function getRecentDocuments(): RecentDocumentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as RecentDocumentItem[];
    if (Array.isArray(items)) {
      return items.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    }
    return [];
  } catch (error) {
    console.error('Failed to load recent documents:', error);
    return [];
  }
}

export function addRecentDocument(entry: Pick<RecentDocumentItem, 'title' | 'path' | 'fileHandleId' | 'fileName' | 'size'>): RecentDocumentItem[] {
  try {
    if (!entry.path && !entry.fileHandleId) return getRecentDocuments();
    const existing = getRecentDocuments();
    // Filter out duplicates by path
    const matches = (item: RecentDocumentItem) => entry.path ? item.path === entry.path : item.fileHandleId === entry.fileHandleId;
    const previous = existing.find(matches);
    const filtered = existing.filter((item) => !matches(item));
    const newItem: RecentDocumentItem = {
      id: previous?.id || crypto.randomUUID(),
      title: entry.title.trim() || '未命名文档',
      path: entry.path,
      fileHandleId: entry.fileHandleId,
      fileName: entry.fileName,
      lastOpenedAt: new Date().toISOString(),
      size: entry.size,
    };
    const updated = [newItem, ...filtered].slice(0, MAX_RECENT_COUNT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to add recent document:', error);
    return getRecentDocuments();
  }
}

export function removeRecentDocument(id: string): RecentDocumentItem[] {
  try {
    const existing = getRecentDocuments();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Failed to remove recent document:', error);
    return getRecentDocuments();
  }
}

export function clearRecentDocuments(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear recent documents:', error);
  }
}
