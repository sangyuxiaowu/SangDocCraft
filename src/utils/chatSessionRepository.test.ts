import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDocumentChatSessions,
  deleteChatSession,
  getChatSession,
  listChatSessions,
  putChatSession,
  cleanupOrphanChatSessions,
} from './imageRepository';
import { DocumentChatSession } from '../types/ai';

describe('chat session repository', () => {
  beforeEach(async () => {
    await clearDocumentChatSessions('doc-1');
    await clearDocumentChatSessions('doc-2');
  });

  it('stores and retrieves chat sessions associated with a document', async () => {
    const session: DocumentChatSession = {
      id: 'session-1',
      documentId: 'doc-1',
      title: '关于系统架构优化的讨论',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        { role: 'user', content: '请帮我优化架构图' },
        { role: 'assistant', content: '已为您调整 Mermaid 架构图' }
      ]
    };

    await putChatSession(session);
    const retrieved = await getChatSession('session-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe('关于系统架构优化的讨论');
    expect(retrieved?.messages).toHaveLength(2);

    const list = await listChatSessions('doc-1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('session-1');
  });

  it('clears sessions for a specific document without affecting others', async () => {
    const s1: DocumentChatSession = {
      id: 's1',
      documentId: 'doc-1',
      title: '会话 1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    const s2: DocumentChatSession = {
      id: 's2',
      documentId: 'doc-2',
      title: '会话 2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };

    await putChatSession(s1);
    await putChatSession(s2);

    await clearDocumentChatSessions('doc-1');
    expect(await listChatSessions('doc-1')).toHaveLength(0);
    expect(await listChatSessions('doc-2')).toHaveLength(1);
  });

  it('deletes an individual chat session', async () => {
    const s: DocumentChatSession = {
      id: 's-to-del',
      documentId: 'doc-1',
      title: '临时会话',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };

    await putChatSession(s);
    expect(await getChatSession('s-to-del')).not.toBeNull();
    await deleteChatSession('s-to-del');
    expect(await getChatSession('s-to-del')).toBeNull();
  });
});
