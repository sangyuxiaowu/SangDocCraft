export interface RecentDocumentItem {
  id: string;
  title: string;
  path: string;
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

export function addRecentDocument(entry: { title: string; path: string; size?: number }): RecentDocumentItem[] {
  try {
    if (!entry.path) return getRecentDocuments();
    const existing = getRecentDocuments();
    // Filter out duplicates by path
    const filtered = existing.filter((item) => item.path !== entry.path);
    const newItem: RecentDocumentItem = {
      id: Math.random().toString(36).slice(2),
      title: entry.title.trim() || '未命名文档',
      path: entry.path,
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

export function removeRecentDocument(path: string): RecentDocumentItem[] {
  try {
    const existing = getRecentDocuments();
    const updated = existing.filter((item) => item.path !== path);
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
