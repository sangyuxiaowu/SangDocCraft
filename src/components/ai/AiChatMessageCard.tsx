import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Check, ChevronDown, ChevronRight, Copy, GitFork, Lightbulb, RotateCcw, Wrench } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { AiChatMessage } from '../../types/ai';
import { containsMath, ensureMathLoaded, onMathReady } from '../../utils/mathRenderer';

interface AiChatMessageCardProps {
  message: AiChatMessage;
  toolResults: AiChatMessage[];
  isDark: boolean;
  reasoningOpen: boolean;
  toolOpen: boolean;
  onToggleReasoning: () => void;
  onToggleTools: () => void;
  onFork: () => void;
  onRegenerate?: () => void;
  onRetryTools?: () => void;
}

function renderMarkdown(markdown: string): string {
  // 公式由 MathJax 渲染为内联 SVG，需要放开 SVG 与 mjx-container 标签
  return DOMPurify.sanitize(marked.parse(markdown) as string, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_TAGS: ['mjx-container', 'use'],
    ADD_ATTR: ['jax', 'display', 'data-c', 'xlink:href'],
  });
}

function formatJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export const AiChatMessageCard: React.FC<AiChatMessageCardProps> = ({
  message,
  toolResults,
  isDark,
  reasoningOpen,
  toolOpen,
  onToggleReasoning,
  onToggleTools,
  onFork,
  onRegenerate,
  onRetryTools,
}) => {
  const [copied, setCopied] = useState(false);
  const [, setMathEpoch] = useState(0);
  const isAssistant = message.role === 'assistant';

  // 回复中的公式需要按需加载 MathJax，加载完成后重新渲染
  useEffect(() => {
    if (!containsMath(message.content)) return;
    let cancelled = false;
    const unsubscribe = onMathReady(() => {
      if (!cancelled) setMathEpoch((epoch) => epoch + 1);
    });
    void ensureMathLoaded().catch((error) => console.warn('公式模块加载失败:', error));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [message.content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={`group flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
      <div className={`max-w-[92%] rounded-2xl p-3 shadow-xs transition-colors ${
        isAssistant
          ? isDark
            ? 'bg-[#1F1F1F] border border-[#2B2B2B] text-zinc-100'
            : 'bg-slate-100 border border-slate-200/80 text-slate-800'
          : 'bg-blue-600 text-white rounded-br-xs'
      }`}>
        {isAssistant && message.reasoning && (
          <div className="mb-2 pb-2 border-b border-white/10 dark:border-zinc-700/50">
            <button type="button" onClick={onToggleReasoning} className="flex items-center gap-1.5 text-[11px] text-amber-500 font-semibold hover:opacity-80">
              <Lightbulb className="w-3 h-3" />
              <span>思考过程</span>
              {reasoningOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {reasoningOpen && (
              <div className="mt-1.5 p-2 rounded-lg bg-black/20 text-[11px] font-mono leading-normal whitespace-pre-wrap max-h-48 overflow-y-auto opacity-85">
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {isAssistant && message.toolCalls?.length ? (
          <div className="mb-2">
            <button type="button" onClick={onToggleTools} className="flex items-center gap-1.5 text-[11px] text-blue-400 font-semibold hover:opacity-80">
              <Wrench className="w-3 h-3" />
              <span>{message.toolCalls.length} 次工具调用</span>
              {toolOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            {toolOpen && (
              <div className="mt-1.5 space-y-2">
                {message.toolCalls.map(toolCall => {
                  const result = toolResults.find(item => item.toolCallId === toolCall.id);
                  return (
                    <div key={toolCall.id} className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2 text-[10px] font-mono">
                      <div className="font-semibold text-blue-400">{toolCall.function.name}</div>
                      <div className="mt-1 opacity-60">执行参数</div>
                      <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap">{formatJson(toolCall.function.arguments)}</pre>
                      <div className="mt-1.5 opacity-60">执行结果</div>
                      <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap">{result?.content || '等待执行结果...'}</pre>
                    </div>
                  );
                })}
              </div>
            )}
            {onRetryTools && (
              <button
                type="button"
                onClick={onRetryTools}
                className="mt-1.5 flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/10"
              >
                <RotateCcw className="h-3 w-3" />
                <span>重试工具调用</span>
              </button>
            )}
          </div>
        ) : null}

        <div
          className="ai-chat-markdown break-words leading-relaxed select-text"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
        />

        {isAssistant && message.usage && (
          <div className="mt-1.5 text-[9px] opacity-50 text-right">
            {message.usage.totalTokens || (message.usage.promptTokens ?? 0) + (message.usage.completionTokens ?? 0)} tokens
          </div>
        )}
      </div>

      {isAssistant && (
        <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => void handleCopy()} className="p-1 rounded hover:bg-blue-500/10" title="复制回复">
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>
          <button type="button" onClick={onFork} className="p-1 rounded hover:bg-blue-500/10" title="从此次回复创建分支">
            <GitFork className="w-3 h-3" />
          </button>
          {onRegenerate && (
            <button type="button" onClick={onRegenerate} className="p-1 rounded hover:bg-blue-500/10" title="重新生成此次回复">
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};