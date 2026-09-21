import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Sparkles, 
  X, 
  Minus, 
  Maximize2, 
  Settings, 
  Send, 
  Square, 
  GripHorizontal, 
  Cpu, 
  ChevronDown, 
  ChevronRight, 
  Lightbulb, 
  Wrench, 
  AlertCircle,
  CheckCircle2,
  FileCode,
  Layers,
  ArrowUpRight,
  Plus,
  History,
  Trash2,
  Clock,
  MessageSquare,
  Brain,
  Pencil,
  Check
} from 'lucide-react';
import { 
  AiChatMessage, 
  AiConfig, 
  AiModelConfig, 
  AiQuickPrompt, 
  AiToolRuntime, 
  DiffReviewSession,
  DocumentChatSession 
} from '../../types/ai';
import { 
  loadAiQuickPrompts, 
  loadAiSystemPrompt, 
  normalizeAiConfig, 
  resolveAiModelOption, 
  setAiConfigActiveSelection, 
  toAiRequestConfig 
} from '../../lib/aiConfig';
import { retryPendingToolCalls, streamConversation } from '../../utils/aiStream';
import { SYSTEM_PROMPT, buildAiTools, AiToolContext } from '../../utils/aiAssistantService';
import { 
  clearDocumentChatSessions, 
  deleteChatSession, 
  listChatSessions, 
  putChatSession 
} from '../../utils/imageRepository';
import { AiChatMessageCard } from './AiChatMessageCard';

interface LiveToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
  isError?: boolean;
}

function hasUnresolvedToolCalls(messages: AiChatMessage[]) {
  const assistantIndex = messages.findLastIndex(message => message.role === 'assistant' && message.toolCalls?.length);
  if (assistantIndex < 0) return false;

  const assistantMessage = messages[assistantIndex];
  const toolResults: AiChatMessage[] = [];
  for (let index = assistantIndex + 1; messages[index]?.role === 'tool'; index++) {
    toolResults.push(messages[index]);
  }

  return Boolean(assistantMessage.toolCalls?.some(toolCall => {
    const result = toolResults.find(message => message.toolCallId === toolCall.id);
    return !result || result.toolStatus === 'timeout' || result.toolRetryable === true;
  }));
}

interface AiAssistantFloatProps {
  isOpen: boolean;
  onClose: () => void;
  config: AiConfig;
  onConfigChange: (newConfig: AiConfig) => void;
  onOpenSettings: () => void;
  toolContext: AiToolContext;
  documentId?: string;
  isDark: boolean;
}

export const AiAssistantFloat: React.FC<AiAssistantFloatProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  onOpenSettings,
  toolContext,
  documentId,
  isDark
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [currentText, setCurrentText] = useState('');
  const [liveToolCalls, setLiveToolCalls] = useState<LiveToolCall[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showReasoningMap, setShowReasoningMap] = useState<Record<number, boolean>>({});
  const [showToolMap, setShowToolMap] = useState<Record<number, boolean>>({});

  // Chat sessions management state
  const [sessions, setSessions] = useState<DocumentChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');

  // Dynamic system prompt & quick prompts
  const [systemPrompt, setSystemPrompt] = useState<string>(() => loadAiSystemPrompt());
  const [quickPrompts, setQuickPrompts] = useState<AiQuickPrompt[]>(() => loadAiQuickPrompts());

  // Draggable window coordinates
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('sangdoccraft_ai_float_pos');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      x: Math.max(20, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 540),
      y: Math.max(20, (typeof window !== 'undefined' ? window.innerHeight : 800) - 640)
    };
  });

  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const dragStartPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeOption = resolveAiModelOption(config);
  const activeSessionTitle = sessions.find(session => session.id === activeSessionId)?.title || '新对话';
  const hasPendingToolCalls = hasUnresolvedToolCalls(messages);
  const sessionTokenUsage = messages.reduce((usage, message) => {
    const promptTokens = message.usage?.promptTokens ?? 0;
    const completionTokens = message.usage?.completionTokens ?? 0;
    return {
      promptTokens: usage.promptTokens + promptTokens,
      completionTokens: usage.completionTokens + completionTokens,
      totalTokens: usage.totalTokens + (message.usage?.totalTokens ?? promptTokens + completionTokens)
    };
  }, { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  const contextWindow = activeOption?.model.contextWindow ?? 0;
  const tokenUsagePercent = contextWindow > 0 ? (sessionTokenUsage.totalTokens / contextWindow) * 100 : 0;
  const tokenRingPercent = Math.min(tokenUsagePercent, 100);

  // Synchronize dynamic prompt and shortcuts on custom events
  useEffect(() => {
    const handleSettingsUpdated = () => {
      setSystemPrompt(loadAiSystemPrompt());
      setQuickPrompts(loadAiQuickPrompts());
    };
    window.addEventListener('sdc:ai-settings-updated', handleSettingsUpdated);
    return () => window.removeEventListener('sdc:ai-settings-updated', handleSettingsUpdated);
  }, []);

  // Load chat sessions when documentId changes
  const loadSessionsForDoc = useCallback(async (docId: string) => {
    try {
      const list = await listChatSessions(docId);
      setSessions(list);
      if (list.length > 0) {
        setActiveSessionId(list[0].id);
        setMessages(list[0].messages);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  }, []);

  useEffect(() => {
    if (documentId) {
      void loadSessionsForDoc(documentId);
    }
  }, [documentId, loadSessionsForDoc]);

  // Listen to chat sessions cleared (e.g. after saving to SDC)
  useEffect(() => {
    const handleSessionsCleared = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.documentId === documentId) {
        setMessages([]);
        setActiveSessionId(null);
        setSessions([]);
      }
    };
    window.addEventListener('sdc:chat-sessions-cleared', handleSessionsCleared);
    return () => window.removeEventListener('sdc:chat-sessions-cleared', handleSessionsCleared);
  }, [documentId]);

  useEffect(() => {
    try {
      localStorage.setItem('sangdoccraft_ai_float_pos', JSON.stringify(position));
    } catch {}
  }, [position]);

  useEffect(() => {
    const keepFloatInViewport = () => {
      const panelWidth = Math.min(520, window.innerWidth - 20);
      const panelHeight = Math.min(620, window.innerHeight - 30);
      setPosition(previous => ({
        x: Math.max(10, Math.min(previous.x, window.innerWidth - panelWidth - 10)),
        y: Math.max(10, Math.min(previous.y, window.innerHeight - panelHeight - 10))
      }));
    };

    keepFloatInViewport();
    window.addEventListener('resize', keepFloatInViewport);
    return () => window.removeEventListener('resize', keepFloatInViewport);
  }, [isOpen]);

  useEffect(() => {
    if (!isMinimized && isOpen && !showHistoryDrawer && shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentReasoning, currentText, liveToolCalls, isMinimized, isOpen, showHistoryDrawer]);

  const handleMessagesScroll = () => {
    const container = messagesScrollRef.current;
    if (!container) return;
    shouldAutoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 32;
  };

  // Dragging event handlers
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, textarea, .no-drag')) {
      return;
    }
    isDraggingRef.current = true;
    didDragRef.current = false;
    dragStartPointRef.current = { x: e.clientX, y: e.clientY };
    dragStartOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      if (Math.hypot(
        moveEvent.clientX - dragStartPointRef.current.x,
        moveEvent.clientY - dragStartPointRef.current.y
      ) > 4) {
        didDragRef.current = true;
      }
      const nextX = Math.max(10, Math.min(window.innerWidth - 100, moveEvent.clientX - dragStartOffsetRef.current.x));
      const nextY = Math.max(10, Math.min(window.innerHeight - 80, moveEvent.clientY - dragStartOffsetRef.current.y));
      setPosition({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleClickAfterDrag = (e: React.MouseEvent) => {
    if (!didDragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
  };

  // Helper to persist current session to IndexedDB
  const persistSession = async (updatedMessages: AiChatMessage[], sessionIdToUse?: string) => {
    if (!documentId || updatedMessages.length === 0) return;
    const sid = sessionIdToUse || activeSessionId || `session-${Date.now()}`;
    if (!activeSessionId) {
      setActiveSessionId(sid);
    }

    const firstUserMsg = updatedMessages.find(m => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 24).trim() : '新对话';
    const existing = sessions.find(s => s.id === sid);

    const sessionData: DocumentChatSession = {
      id: sid,
      documentId,
      title: existing?.title || title || '新对话',
      messages: updatedMessages,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await putChatSession(sessionData);
    const refreshed = await listChatSessions(documentId);
    setSessions(refreshed);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowHistoryDrawer(false);
  };

  const handleSelectSession = (session: DocumentChatSession) => {
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setShowHistoryDrawer(false);
  };

  const handleStartEditingSession = (session: DocumentChatSession) => {
    setEditingSessionId(session.id);
    setEditingSessionTitle(session.title || '新对话');
  };

  const handleRenameSession = async (session: DocumentChatSession) => {
    const nextTitle = editingSessionTitle.trim();
    setEditingSessionId(null);
    if (!nextTitle || nextTitle === session.title) return;

    await putChatSession({
      ...session,
      title: nextTitle,
      updatedAt: new Date().toISOString()
    });
    if (documentId) {
      const refreshed = await listChatSessions(documentId);
      setSessions(refreshed);
    }
  };

  const handleDeleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteChatSession(sid);
    if (activeSessionId === sid) {
      setActiveSessionId(null);
      setMessages([]);
    }
    if (documentId) {
      const refreshed = await listChatSessions(documentId);
      setSessions(refreshed);
    }
  };

  const handleClearAllHistory = async () => {
    if (!documentId) return;
    await clearDocumentChatSessions(documentId);
    setActiveSessionId(null);
    setMessages([]);
    setSessions([]);
  };

  // 每次请求都基于最新文档状态新建一套工具：工具 handler 会持有正文/主题基线，不能跨请求复用。
  // 统一在此构造，避免多个调用点各自实现导致行为漂移。
  const createRequestTools = () => buildAiTools(toolContext);

  // 点「停止生成」时一并收起可能挂起的正文审查，否则审查面板会悬空等待（工具超时上限 10 分钟）。
  const createAbortController = () => {
    const controller = new AbortController();
    controller.signal.addEventListener('abort', () => toolContext.onCancelDiffReview(), { once: true });
    return controller;
  };

  const generateResponse = async (baseMessages: AiChatMessage[], targetSessionId: string) => {
    const requestConfig = toAiRequestConfig(config);
    if (!requestConfig || !requestConfig.apiKey) {
      onOpenSettings();
      return;
    }

    setMessages(baseMessages);
    setIsStreaming(true);
    setCurrentReasoning('');
    setCurrentText('');
    setLiveToolCalls([]);
    await persistSession(baseMessages, targetSessionId);

    const abortController = createAbortController();
    abortControllerRef.current = abortController;

    try {
      const result = await streamConversation({
        config: requestConfig,
        messages: [{ role: 'system', content: systemPrompt }, ...baseMessages],
        tools: createRequestTools(),
        signal: abortController.signal,
        onReasoningChunk: chunk => setCurrentReasoning(previous => previous + chunk),
        onTextChunk: chunk => setCurrentText(previous => previous + chunk),
        onToolCall: toolCall => {
          setLiveToolCalls(previous => {
            const existing = previous.find(item => item.id === toolCall.id);
            return existing
              ? previous.map(item => item.id === toolCall.id ? { ...item, ...toolCall } : item)
              : [...previous, toolCall];
          });
        },
        onToolResult: toolResult => {
          setLiveToolCalls(previous => previous.map(item => item.id === toolResult.id
            ? { ...item, result: toolResult.result, isError: toolResult.isError }
            : item));
        }
      });

      const finalMessages = result.transcript.filter(message => message.role !== 'system');
      setMessages(finalMessages);
      await persistSession(finalMessages, targetSessionId);
    } catch (error) {
      const assistantMessage: AiChatMessage = {
        role: 'assistant',
        content: abortController.signal.aborted
          ? '已由用户停止生成。'
          : `请求失败: ${error instanceof Error ? error.message : '请求异常，请检查配置。'}\n\n请检查 API 端点与 Key 配置是否正确。`
      };
      const failedMessages = [...baseMessages, assistantMessage];
      setMessages(failedMessages);
      await persistSession(failedMessages, targetSessionId);
    } finally {
      setIsStreaming(false);
      setCurrentReasoning('');
      setCurrentText('');
      setLiveToolCalls([]);
      abortControllerRef.current = null;
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isStreaming || hasPendingToolCalls) return;

    const userMessage: AiChatMessage = {
      role: 'user',
      content: messageContent
    };

    const targetSessionId = activeSessionId || `session-${Date.now()}`;
    if (!activeSessionId) {
      setActiveSessionId(targetSessionId);
    }

    const newMessages = [...messages, userMessage];
    shouldAutoScrollRef.current = true;
    setMessages(newMessages);
    setInputText('');
    await generateResponse(newMessages, targetSessionId);
  };

  const handleForkFrom = async (messageIndex: number) => {
    let endIndex = messageIndex + 1;
    while (messages[endIndex]?.role === 'tool') endIndex++;
    const forkedMessages = messages.slice(0, endIndex);
    const forkedSessionId = `session-${Date.now()}`;
    setActiveSessionId(forkedSessionId);
    setMessages(forkedMessages);
    await persistSession(forkedMessages, forkedSessionId);
  };

  const handleRegenerateLast = async () => {
    if (isStreaming) return;
    const lastUserIndex = messages.findLastIndex(message => message.role === 'user');
    if (lastUserIndex < 0) return;
    const targetSessionId = activeSessionId || `session-${Date.now()}`;
    await generateResponse(messages.slice(0, lastUserIndex + 1), targetSessionId);
  };

  const handleRetryTools = async () => {
    if (isStreaming) return;
    const requestConfig = toAiRequestConfig(config);
    if (!requestConfig || !requestConfig.apiKey) {
      onOpenSettings();
      return;
    }

    const targetSessionId = activeSessionId || `session-${Date.now()}`;
    if (!activeSessionId) setActiveSessionId(targetSessionId);
    shouldAutoScrollRef.current = true;
    setIsStreaming(true);
    setCurrentReasoning('');
    setCurrentText('');
    setLiveToolCalls([]);

    const abortController = createAbortController();
    abortControllerRef.current = abortController;
    try {
      const result = await retryPendingToolCalls({
        config: requestConfig,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        tools: createRequestTools(),
        signal: abortController.signal,
        onReasoningChunk: chunk => setCurrentReasoning(previous => previous + chunk),
        onTextChunk: chunk => setCurrentText(previous => previous + chunk),
        onToolCall: toolCall => setLiveToolCalls(previous => {
          const existing = previous.find(item => item.id === toolCall.id);
          return existing
            ? previous.map(item => item.id === toolCall.id ? { ...item, ...toolCall } : item)
            : [...previous, toolCall];
        }),
        onToolResult: toolResult => setLiveToolCalls(previous => previous.map(item => item.id === toolResult.id
          ? { ...item, result: toolResult.result, isError: toolResult.isError }
          : item))
      });
      const finalMessages = result.transcript.filter(message => message.role !== 'system');
      setMessages(finalMessages);
      await persistSession(finalMessages, targetSessionId);
    } catch (error) {
      const failureMessage: AiChatMessage = {
        role: 'assistant',
        content: abortController.signal.aborted
          ? '已由用户停止重试。'
          : `重试失败: ${error instanceof Error ? error.message : '请求异常，请检查配置。'}`
      };
      const failedMessages = [...messages, failureMessage];
      setMessages(failedMessages);
      await persistSession(failedMessages, targetSessionId);
    } finally {
      setIsStreaming(false);
      setCurrentReasoning('');
      setCurrentText('');
      setLiveToolCalls([]);
      abortControllerRef.current = null;
    }
  };

  const updateActiveModel = (updater: (model: AiModelConfig) => AiModelConfig) => {
    if (!activeOption) return;
    onConfigChange({
      ...config,
      endpoints: config.endpoints.map(endpoint => endpoint.id === activeOption.endpoint.id
        ? {
            ...endpoint,
            models: endpoint.models.map(model => model.id === activeOption.model.id ? updater(model) : model)
          }
        : endpoint)
    });
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  if (!isOpen) return null;

  // Minimized Floating Pill Mode
  if (isMinimized) {
    return (
      <div
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onMouseDown={handleMouseDownHeader}
        onClickCapture={handleClickAfterDrag}
        className={`fixed z-[65] select-none flex items-center gap-2 px-3 py-2 rounded-full border shadow-2xl cursor-grab active:cursor-grabbing backdrop-blur-md transition-shadow animate-in zoom-in-95 duration-150 ${
          isDark 
            ? 'bg-[#181818]/95 border-blue-500/40 text-zinc-100 hover:border-blue-400' 
            : 'bg-white/95 border-blue-400/60 text-slate-800 hover:border-blue-500'
        }`}
      >
        <div 
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 cursor-pointer"
          title="点击展开 AI 助手"
        >
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold tracking-tight">AI 助手</span>
          {isStreaming && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </div>

        <div className="flex items-center gap-0.5 ml-1 border-l pl-1.5 border-zinc-500/30">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded hover:bg-white/10"
            title="展开面板"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
            title="关闭浮窗"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className={`fixed z-[65] w-[480px] max-w-[calc(100vw-20px)] h-[620px] max-h-[calc(100vh-30px)] flex flex-col rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-md animate-in zoom-in-95 duration-150 ${
        isDark ? 'bg-[#141414]/95 border-[#2E2E2E] text-zinc-100' : 'bg-white/95 border-slate-200/90 text-slate-800'
      }`}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDownHeader}
        className={`shrink-0 px-3.5 py-2.5 border-b select-none cursor-grab active:cursor-grabbing flex items-center justify-between gap-2 ${
          isDark ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GripHorizontal className="w-4 h-4 opacity-40 shrink-0" />
          <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="min-w-0 truncate text-xs font-bold" title={activeSessionTitle}>
            {activeSessionTitle}
          </span>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="新建对话"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* History Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowHistoryDrawer(prev => !prev)}
            className={`p-1.5 rounded-lg transition-colors relative ${
              showHistoryDrawer
                ? 'bg-blue-600 text-white'
                : isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="查看历史对话记录"
          >
            <History className="w-3.5 h-3.5" />
            {sessions.length > 0 && !showHistoryDrawer && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white dark:ring-zinc-900" />
            )}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="配置 AI 服务端点、提示词与快捷短语"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="最小化为悬浮球"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
            title="关闭浮窗"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* History Drawer Overlay */}
      {showHistoryDrawer && (
        <div className={`absolute inset-x-0 top-[45px] bottom-0 z-40 flex flex-col animate-in fade-in duration-150 ${
          isDark ? 'bg-[#141414]' : 'bg-white'
        }`}>
          <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 ${
            isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold">本文档历史对话 ({sessions.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewChat}
                className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>新建对话</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {sessions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
                <div className="text-xs font-semibold">暂无历史对话记录</div>
                <div className="text-[11px] opacity-70 mt-1">
                  在主窗口发送提问，对话记录将与本文档自动关联保存。
                </div>
              </div>
            ) : (
              sessions.map(s => {
                const isActive = activeSessionId === s.id;
                const formattedTime = new Date(s.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                const formattedDate = new Date(s.updatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });

                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSession(s)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isActive
                        ? isDark ? 'bg-blue-950/30 border-blue-500/50 text-blue-300' : 'bg-blue-50 border-blue-300 text-blue-900'
                        : isDark ? 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 text-zinc-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {editingSessionId === s.id ? (
                        <input
                          autoFocus
                          type="text"
                          maxLength={80}
                          value={editingSessionTitle}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setEditingSessionTitle(e.target.value)}
                          onBlur={() => void handleRenameSession(s)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleRenameSession(s);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingSessionId(null);
                            }
                          }}
                          className={`w-full rounded border px-2 py-1 text-xs font-bold outline-hidden focus:ring-2 focus:ring-blue-500/30 ${
                            isDark
                              ? 'bg-zinc-950 border-zinc-700 text-zinc-100'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                          aria-label="编辑对话标题"
                        />
                      ) : (
                        <div className="text-xs font-bold truncate">{s.title || '新对话'}</div>
                      )}
                      <div className="text-[10px] opacity-60 mt-0.5 flex items-center gap-2">
                        <span>{formattedDate} {formattedTime}</span>
                        <span>·</span>
                        <span>{s.messages.filter(m => m.role !== 'system').length} 条消息</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => editingSessionId === s.id
                          ? void handleRenameSession(s)
                          : handleStartEditingSession(s)}
                        className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                        title={editingSessionId === s.id ? '保存标题' : '编辑对话标题'}
                      >
                        {editingSessionId === s.id
                          ? <Check className="w-3.5 h-3.5" />
                          : <Pencil className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void handleDeleteSession(s.id, e)}
                        className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                        title="删除此对话"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {sessions.length > 0 && (
            <div className={`p-3 border-t flex items-center justify-between ${
              isDark ? 'border-zinc-800 bg-zinc-900/30' : 'border-slate-200 bg-slate-50'
            }`}>
              <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                历史对话会保存在 SDC 文件中
              </span>
              <button
                type="button"
                onClick={handleClearAllHistory}
                className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>清空本文档对话</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages List Area */}
      <div
        ref={messagesScrollRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs leading-relaxed"
      >
        {/* Simple Welcome Card - Shown ONLY when message history is empty, NOT saved to history */}
        {messages.length === 0 && (
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 font-bold text-blue-500">
              <Sparkles className="w-4 h-4" />
              <span>智能文档 AI 助手已就绪</span>
            </div>
            <p className="opacity-85 leading-relaxed text-xs">
              您好！我是您的文档与排版助手。您可以向我提出文档撰写、润色、插入分页符与表格题注、生成 Mermaid 架构图或调整样式排版等需求。
            </p>
            <div className="text-[11px] opacity-60">
              💡 发送消息即可开始对话，对话记录将与本文档自动关联保存。
            </div>
          </div>
        )}

        {messages.map((msg, index) => {
          const isAssistant = msg.role === 'assistant';
          const isTool = msg.role === 'tool';
          if (msg.role === 'system' || isTool) return null;

          const isThinkingOpen = showReasoningMap[index] ?? false;
          const isToolOpen = showToolMap[index] ?? false;
          const toolResults: AiChatMessage[] = [];
          for (let resultIndex = index + 1; messages[resultIndex]?.role === 'tool'; resultIndex++) {
            toolResults.push(messages[resultIndex]);
          }
          const canRetryTools = isAssistant
            && index === messages.findLastIndex(message => message.role === 'assistant')
            && Boolean(msg.toolCalls?.some(toolCall => {
              const result = toolResults.find(item => item.toolCallId === toolCall.id);
              return !result || result.toolStatus === 'timeout' || result.toolRetryable === true;
            }));

          return (
            <AiChatMessageCard
              key={index}
              message={msg}
              toolResults={toolResults}
              isDark={isDark}
              reasoningOpen={isThinkingOpen}
              toolOpen={isToolOpen}
              onToggleReasoning={() => setShowReasoningMap(previous => ({ ...previous, [index]: !previous[index] }))}
              onToggleTools={() => setShowToolMap(previous => ({ ...previous, [index]: !previous[index] }))}
              onFork={() => void handleForkFrom(index)}
              onRegenerate={isAssistant && index === messages.findLastIndex(message => message.role === 'assistant') && !isStreaming
                ? () => void handleRegenerateLast()
                : undefined}
              onRetryTools={canRetryTools && !isStreaming ? () => void handleRetryTools() : undefined}
            />
          );
        })}

        {/* Streaming Ongoing State */}
        {isStreaming && (
          <div className="flex flex-col items-start space-y-2">
            {currentReasoning && (
              <div className="max-w-[92%] rounded-xl p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px]">
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <Lightbulb className="w-3 h-3 animate-pulse" />
                  <span>正在深入思考推理中...</span>
                </div>
                <div className="font-mono text-[10px] leading-normal opacity-85 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {currentReasoning}
                </div>
              </div>
            )}

            {liveToolCalls.map(toolCall => (
              <div key={toolCall.id} className="max-w-[92%] rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 p-2 text-[10px] font-mono">
                <div className="flex items-center gap-1.5 font-semibold"><Wrench className="w-3 h-3" />{toolCall.name}</div>
                <div className="mt-1 opacity-60">执行参数</div>
                <pre className="overflow-x-auto whitespace-pre-wrap">{toolCall.arguments}</pre>
                <div className="mt-1 opacity-60">执行结果</div>
                <pre className={toolCall.isError ? 'text-rose-400 whitespace-pre-wrap' : 'whitespace-pre-wrap'}>{toolCall.result || '执行中...'}</pre>
              </div>
            ))}

            {currentText && (
              <AiChatMessageCard
                message={{ role: 'assistant', content: currentText }}
                toolResults={[]}
                isDark={isDark}
                reasoningOpen
                toolOpen
                onToggleReasoning={() => undefined}
                onToggleTools={() => undefined}
                onFork={() => undefined}
              />
            )}

            {!currentReasoning && !currentText && liveToolCalls.length === 0 && (
              <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-slate-100 text-slate-600'
              }`}>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span>AI 正在思考并组织回复...</span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Chips - ONLY displayed when quickPrompts is not empty */}
      {quickPrompts.length > 0 && (
        <div className={`px-3 py-2 border-t overflow-x-auto flex items-center gap-1.5 no-scrollbar shrink-0 ${
          isDark ? 'bg-[#181818] border-[#262626]' : 'bg-slate-50 border-slate-200'
        }`}>
          <span className="text-[10px] font-bold uppercase opacity-50 shrink-0">快捷:</span>
          {quickPrompts.map(qp => (
            <button
              key={qp.id}
              type="button"
              disabled={isStreaming || hasPendingToolCalls}
              onClick={() => void handleSendMessage(qp.prompt)}
              className={`text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors flex items-center gap-1 shrink-0 ${
                isDark 
                  ? 'bg-zinc-900 border-zinc-700 hover:border-blue-500 hover:text-blue-400 text-zinc-300' 
                  : 'bg-white border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-700 shadow-2xs'
              }`}
            >
              <span>{qp.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className={`p-3 border-t shrink-0 ${
        isDark ? 'bg-[#181818] border-[#262626]' : 'bg-white border-slate-200'
      }`}>
        <div className={`relative rounded-xl border transition-colors focus-within:border-blue-500 ${
          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDownInput}
            disabled={hasPendingToolCalls}
            placeholder={isStreaming
              ? '正在生成回复中...'
              : hasPendingToolCalls
                ? '请先重试未完成的工具调用'
                : '向 AI 助手描述修改意图，Ctrl+Enter 发送'}
            rows={3}
            className={`block w-full rounded-[11px] border-0 p-2.5 pb-9 text-xs resize-none focus:outline-hidden leading-normal ${
              isDark 
                ? 'bg-zinc-950 text-zinc-100 placeholder:text-zinc-500' 
                : 'bg-slate-50 text-slate-900 placeholder:text-slate-400'
            }`}
          />
          <div className="absolute inset-x-0 bottom-1.5 h-5 flex items-center justify-between gap-2 px-2 bg-transparent">
            <div className="flex items-center gap-1 min-w-0">
              <div className="group/token relative shrink-0">
                <div
                  className="relative w-6 h-6 rounded-full"
                  style={{ background: `conic-gradient(rgb(59 130 246) ${tokenRingPercent}%, ${isDark ? 'rgb(63 63 70)' : 'rgb(203 213 225)'} 0)` }}
                  aria-label={`会话 Token 使用率 ${tokenUsagePercent.toFixed(1)}%`}
                >
                  <div className={`absolute inset-[2px] rounded-full flex items-center justify-center ${isDark ? 'bg-zinc-950' : 'bg-slate-50'}`}>
                    <span className="text-[7px] font-bold leading-none">{Math.round(tokenUsagePercent)}%</span>
                  </div>
                </div>
                <div className={`pointer-events-none absolute left-0 bottom-full mb-2 hidden group-hover/token:block group-focus-within/token:block w-56 rounded-lg border p-2.5 shadow-2xl z-50 text-[10px] ${
                  isDark ? 'bg-[#1C1C1C] border-[#333] text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <div className="mb-1.5 truncate font-bold" title={activeOption?.model.label || '未配置模型'}>
                    {activeOption?.model.label || '未配置模型'}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span className="opacity-60">输入 Token</span>
                    <span className="text-right font-mono">{sessionTokenUsage.promptTokens.toLocaleString()}</span>
                    <span className="opacity-60">输出 Token</span>
                    <span className="text-right font-mono">{sessionTokenUsage.completionTokens.toLocaleString()}</span>
                    <span className="opacity-60">会话总计</span>
                    <span className="text-right font-mono">{sessionTokenUsage.totalTokens.toLocaleString()}</span>
                    <span className="opacity-60">上下文窗口</span>
                    <span className="text-right font-mono">{contextWindow.toLocaleString()}</span>
                    <span className="opacity-60">使用率</span>
                    <span className="text-right font-mono">{tokenUsagePercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="relative min-w-0">
                <button
                  type="button"
                  onClick={() => setShowModelDropdown(prev => !prev)}
                  className={`h-5 max-w-[130px] px-1.5 rounded-md flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                    isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                  title="切换当前模型"
                >
                  <span className="truncate">
                    {activeOption ? activeOption.model.label : '配置模型'}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                </button>

                {showModelDropdown && (
                  <div
                    className={`absolute left-0 bottom-full mb-2 w-[270px] border rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in-50 duration-100 ${
                      isDark ? 'bg-[#1C1C1C] border-[#333]' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                      选择可用模型
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                      {config.endpoints.map(ep => (
                        <div key={ep.id} className="pt-1">
                          <div className={`px-2 text-[10px] font-bold truncate opacity-50 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                            {ep.name}
                          </div>
                          {ep.models.map(m => {
                            const isSelected = activeOption?.selection.endpointId === ep.id && activeOption?.selection.modelId === m.id;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  onConfigChange(setAiConfigActiveSelection(config, { endpointId: ep.id, modelId: m.id }));
                                  setShowModelDropdown(false);
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between gap-1.5 transition-colors ${
                                  isSelected
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : isDark ? 'hover:bg-zinc-800 text-zinc-200' : 'hover:bg-slate-100 text-slate-700'
                                }`}
                              >
                                <span className="truncate">{m.label}</span>
                                {m.thinkingAvailable && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-500 shrink-0">
                                    思考
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {activeOption?.model.thinkingAvailable && (
                <>
                  <button
                    type="button"
                    onClick={() => updateActiveModel(model => ({ ...model, thinkingEnabled: !model.thinkingEnabled }))}
                    className={`h-5 px-1.5 rounded-md flex items-center gap-1 text-[10px] font-semibold transition-colors ${
                      activeOption.model.thinkingEnabled
                        ? 'bg-blue-600/15 text-blue-500'
                        : isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-200'
                    }`}
                    title="切换思考模式"
                  >
                    <Brain className="w-3 h-3" />
                    <span>思考</span>
                  </button>
                  <select
                    aria-label="思考强度"
                    value={activeOption.model.reasoningEffort}
                    disabled={!activeOption.model.thinkingEnabled}
                    onChange={event => updateActiveModel(model => ({ ...model, reasoningEffort: event.target.value as AiModelConfig['reasoningEffort'] }))}
                    className={`h-5 rounded-md border-0 bg-transparent px-1 text-[10px] font-medium focus:outline-hidden disabled:opacity-40 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}
                    title="思考强度"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="xhigh">XHigh</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isStreaming ? (
                <button type="button" onClick={handleStopGenerating} className="p-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white" title="停止生成">
                  <Square className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!inputText.trim() || hasPendingToolCalls}
                  className="relative -top-0.5 w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white transition-colors"
                  title="发送消息 (Ctrl+Enter)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
