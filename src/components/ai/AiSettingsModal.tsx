import React, { useEffect, useState } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  HelpCircle,
  Cpu,
  RotateCcw,
  FileText,
  MessageSquareQuote
} from 'lucide-react';
import { 
  AiConfig, 
  AiEndpointConfig, 
  AiModelConfig, 
  AiQuickPrompt, 
  AiReasoningEffort 
} from '../../types/ai';
import { 
  DEFAULT_QUICK_PROMPTS,
  loadAiQuickPrompts,
  loadAiSystemPrompt,
  normalizeAiConfig, 
  resetAiQuickPrompts,
  resetAiSystemPrompt,
  resolveAiModelOption, 
  saveAiQuickPrompts, 
  saveAiSystemPrompt, 
  setAiConfigActiveSelection 
} from '../../lib/aiConfig';
import { DEFAULT_SYSTEM_PROMPT } from '../../utils/aiAssistantService';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AiConfig;
  onConfigChange: (newConfig: AiConfig) => void;
  isDark: boolean;
}

const REASONING_EFFORT_OPTIONS: Array<{ value: AiReasoningEffort; label: string; description: string }> = [
  { value: 'low', label: 'Low', description: '最低思考强度，响应速度更快' },
  { value: 'medium', label: 'Medium', description: '均衡模式，适合大多数通用写作任务' },
  { value: 'high', label: 'High', description: '更积极的推理与全面展开' },
  { value: 'xhigh', label: 'XHigh', description: '最高思考强度，适合复杂排版与长链路设计推演' }
];

type SettingsTab = 'models' | 'prompt' | 'quick-prompts';

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  isDark
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('models');
  const [localConfig, setLocalConfig] = useState<AiConfig>(() => normalizeAiConfig(config));
  const [systemPrompt, setSystemPrompt] = useState<string>(() => loadAiSystemPrompt());
  const [quickPrompts, setQuickPrompts] = useState<AiQuickPrompt[]>(() => loadAiQuickPrompts());
  const [collapsedEndpointIds, setCollapsedEndpointIds] = useState<string[]>([]);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message?: string; isError?: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) setLocalConfig(normalizeAiConfig(config));
  }, [config, isOpen]);

  if (!isOpen) return null;

  const normalized = normalizeAiConfig(localConfig);
  const activeModelOption = resolveAiModelOption(normalized);

  const handleAddEndpoint = () => {
    const newEndpointId = `endpoint-${Date.now()}`;
    const newEndpoint: AiEndpointConfig = {
      id: newEndpointId,
      name: `自定义端点 ${normalized.endpoints.length + 1}`,
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: '',
      models: [
        {
          id: `model-${Date.now()}`,
          label: 'deepseek-flash',
          modelId: 'deepseek-flash',
          contextWindow: 1000000,
          maxTokens: 384000,
          temperature: 0.7,
          thinkingAvailable: false,
          thinkingEnabled: false,
          reasoningEffort: 'medium'
        }
      ]
    };

    setLocalConfig(prev => ({
      ...prev,
      endpoints: [...prev.endpoints, newEndpoint]
    }));
  };

  const handleRemoveEndpoint = (endpointId: string) => {
    if (normalized.endpoints.length <= 1) return;
    const nextEndpoints = normalized.endpoints.filter(e => e.id !== endpointId);
    let active = normalized.activeSelection;
    if (active?.endpointId === endpointId) {
      active = {
        endpointId: nextEndpoints[0].id,
        modelId: nextEndpoints[0].models[0]?.id || ''
      };
    }
    setLocalConfig({
      endpoints: nextEndpoints,
      activeSelection: active
    });
  };

  const handleUpdateEndpoint = (endpointId: string, updater: (ep: AiEndpointConfig) => AiEndpointConfig) => {
    setLocalConfig(prev => ({
      ...prev,
      endpoints: prev.endpoints.map(e => (e.id === endpointId ? updater(e) : e))
    }));
  };

  const handleAddModel = (endpointId: string) => {
    const newModel: AiModelConfig = {
      id: `model-${Date.now()}`,
      label: 'deepseek-flash',
      modelId: 'deepseek-flash',
      contextWindow: 1000000,
      maxTokens: 384000,
      temperature: 0.7,
      thinkingAvailable: false,
      thinkingEnabled: false,
      reasoningEffort: 'medium'
    };

    handleUpdateEndpoint(endpointId, ep => ({
      ...ep,
      models: [...ep.models, newModel]
    }));
  };

  const handleRemoveModel = (endpointId: string, modelId: string) => {
    handleUpdateEndpoint(endpointId, ep => {
      if (ep.models.length <= 1) return ep;
      const nextModels = ep.models.filter(m => m.id !== modelId);
      return {
        ...ep,
        models: nextModels
      };
    });
  };

  const handleUpdateModel = (
    endpointId: string, 
    modelId: string, 
    updater: (model: AiModelConfig) => AiModelConfig
  ) => {
    handleUpdateEndpoint(endpointId, ep => ({
      ...ep,
      models: ep.models.map(m => (m.id === modelId ? updater(m) : m))
    }));
  };

  const toggleEndpointCollapsed = (id: string) => {
    setCollapsedEndpointIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleResetSystemPrompt = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  const handleAddQuickPrompt = () => {
    const newPrompt: AiQuickPrompt = {
      id: `qp-${Date.now()}`,
      label: '新快捷操作',
      prompt: '请帮我优化当前选中的内容，保持结构完整与语法严谨。'
    };
    setQuickPrompts(prev => [...prev, newPrompt]);
  };

  const handleUpdateQuickPrompt = (id: string, field: 'label' | 'prompt', value: string) => {
    setQuickPrompts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleRemoveQuickPrompt = (id: string) => {
    setQuickPrompts(prev => prev.filter(p => p.id !== id));
  };

  const handleResetQuickPrompts = () => {
    setQuickPrompts(DEFAULT_QUICK_PROMPTS);
  };

  const handleClearQuickPrompts = () => {
    setQuickPrompts([]);
  };

  const handleSaveAndClose = () => {
    const finalConfig = normalizeAiConfig(localConfig);
    saveAiSystemPrompt(systemPrompt);
    saveAiQuickPrompts(quickPrompts);
    onConfigChange(finalConfig);
    window.dispatchEvent(new CustomEvent('sdc:ai-settings-updated'));
    onClose();
  };

  const handleTestConnection = async () => {
    if (!activeModelOption) return;
    const { endpoint, model } = activeModelOption;
    if (!endpoint.endpoint || !endpoint.apiKey) {
      setTestStatus({
        loading: false,
        message: '请先填写请求端点 (URL) 和 API Key。',
        isError: true
      });
      return;
    }

    setTestStatus({ loading: true, message: '正在测试连接中...' });
    try {
      const response = await fetch(endpoint.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${endpoint.apiKey}`
        },
        body: JSON.stringify({
          model: model.modelId,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5
        })
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`连接失败 (HTTP ${response.status}): ${errText.slice(0, 120)}`);
      }

      setTestStatus({
        loading: false,
        message: `连接成功！模型 ${model.modelId} 响应正常。`,
        isError: false
      });
    } catch (err) {
      setTestStatus({
        loading: false,
        message: err instanceof Error ? err.message : '连接失败，请检查 URL 与密钥。',
        isError: true
      });
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" 
      role="dialog" 
      aria-modal="true"
    >
      <div className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${
        isDark ? 'bg-[#141414] border-[#2A2A2A] text-zinc-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
          isDark ? 'bg-[#181818] border-[#262626]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">AI 助手配置中心</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                自定义服务端点、模型参数、系统提示词与快捷短语
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg border transition-colors ${
              isDark ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`px-5 pt-2 border-b flex items-center gap-2 ${
          isDark ? 'bg-[#161616] border-[#262626]' : 'bg-slate-100/60 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'models'
                ? 'border-blue-600 text-blue-600 bg-white dark:bg-[#141414]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>端点与模型</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'prompt'
                ? 'border-blue-600 text-blue-600 bg-white dark:bg-[#141414]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>系统提示词</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quick-prompts')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'quick-prompts'
                ? 'border-blue-600 text-blue-600 bg-white dark:bg-[#141414]'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>快捷短语 ({quickPrompts.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: MODELS & ENDPOINTS */}
          {activeTab === 'models' && (
            <>
              {/* Active Model Indicator & Test */}
              <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                isDark ? 'bg-blue-950/20 border-blue-500/30 text-blue-300' : 'bg-blue-50/70 border-blue-200 text-blue-900'
              }`}>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider font-bold opacity-80">当前默认活跃模型</div>
                  <div className="text-sm font-bold truncate mt-0.5">
                    {activeModelOption ? `${activeModelOption.endpoint.name} · ${activeModelOption.model.label} (${activeModelOption.model.modelId})` : '未配置'}
                  </div>
                  <div className="text-xs opacity-75 mt-0.5">
                    {activeModelOption?.model.thinkingAvailable ? '💡 思考模式已支持' : '⚡ 标准对话模式'} · 
                    窗口: {(activeModelOption?.model.contextWindow || 1000000).toLocaleString()} tokens ·
                    输出: {(activeModelOption?.model.maxTokens || 384000).toLocaleString()} tokens
                  </div>
                </div>

                <button
                  type="button"
                  disabled={testStatus?.loading || !activeModelOption?.endpoint.apiKey}
                  onClick={handleTestConnection}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    isDark 
                      ? 'bg-blue-600 hover:bg-blue-500 text-white disabled:bg-zinc-800 disabled:text-zinc-500' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-200 disabled:text-slate-400'
                  }`}
                >
                  {testStatus?.loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>测试连接</span>
                </button>
              </div>

              {testStatus && (
                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                  testStatus.isError 
                    ? isDark ? 'bg-rose-950/30 border border-rose-800 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-700'
                    : isDark ? 'bg-emerald-950/30 border border-emerald-800 text-emerald-300' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                }`}>
                  {testStatus.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{testStatus.message}</span>
                </div>
              )}

              {/* Endpoints List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold tracking-tight">API 端点配置</h4>
                  <button
                    type="button"
                    onClick={handleAddEndpoint}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加端点</span>
                  </button>
                </div>

                {normalized.endpoints.map((endpoint, epIndex) => {
                  const isCollapsed = collapsedEndpointIds.includes(endpoint.id);
                  const isDeepSeek = endpoint.id === 'endpoint-deepseek' || endpoint.name.toLowerCase().includes('deepseek');

                  return (
                    <div 
                      key={endpoint.id}
                      className={`border rounded-xl transition-all overflow-hidden ${
                        isDark ? 'border-[#262626] bg-[#171717]' : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      {/* Endpoint Header */}
                      <div className={`px-4 py-3 flex items-center justify-between gap-3 cursor-pointer ${
                        isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-slate-100/70'
                      }`} onClick={() => toggleEndpointCollapsed(endpoint.id)}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            className="text-zinc-400 hover:text-zinc-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleEndpointCollapsed(endpoint.id);
                            }}
                          >
                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          
                          <div className="min-w-0">
                            <span className="font-bold text-xs truncate block">{endpoint.name || `端点 ${epIndex + 1}`}</span>
                            <span className={`text-[10px] truncate block opacity-60 font-mono ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                              {endpoint.endpoint || '未配置 URL'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                            endpoint.apiKey 
                              ? isDark ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isDark ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {endpoint.apiKey ? '已配置 Key' : '未设置 Key'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRemoveEndpoint(endpoint.id)}
                            disabled={normalized.endpoints.length <= 1}
                            className="p-1.5 rounded hover:bg-rose-500/10 text-rose-500 disabled:opacity-30 transition-colors"
                            title="删除端点"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Endpoint Body */}
                      {!isCollapsed && (
                        <div className={`p-4 border-t space-y-4 ${
                          isDark ? 'border-[#262626] bg-[#121212]' : 'border-slate-200 bg-white'
                        }`}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold mb-1 opacity-80">端点名称</label>
                              <input
                                type="text"
                                value={endpoint.name}
                                onChange={e => handleUpdateEndpoint(endpoint.id, ep => ({ ...ep, name: e.target.value }))}
                                placeholder="例如 DeepSeek 官方"
                                className="w-full px-3 py-1.5 text-xs rounded-lg border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold mb-1 opacity-80">API Key</label>
                              <input
                                type="password"
                                value={endpoint.apiKey}
                                onChange={e => handleUpdateEndpoint(endpoint.id, ep => ({ ...ep, apiKey: e.target.value }))}
                                placeholder="sk-..."
                                className="w-full px-3 py-1.5 text-xs rounded-lg border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold mb-1 opacity-80">端点服务地址 (URL)</label>
                            <input
                              type="text"
                              value={endpoint.endpoint}
                              onChange={e => handleUpdateEndpoint(endpoint.id, ep => ({ ...ep, endpoint: e.target.value }))}
                              placeholder="https://api.deepseek.com/v1/chat/completions"
                              className="w-full px-3 py-1.5 text-xs rounded-lg border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            <p className={`text-[11px] mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                              请填写兼容 OpenAI Chat Completions 规范的完整 URL。
                            </p>
                          </div>

                          {/* Models Container */}
                          <div className={`p-3.5 rounded-xl border space-y-3 ${
                            isDark ? 'bg-[#121212] border-[#222]' : 'bg-white border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider opacity-80">该端点下的模型列表</span>
                              <button
                                type="button"
                                onClick={() => handleAddModel(endpoint.id)}
                                className="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>新增模型</span>
                              </button>
                            </div>

                            <div className="space-y-3">
                              {endpoint.models.map((model) => {
                                const isCurrentDefault = activeModelOption?.selection.endpointId === endpoint.id && activeModelOption?.selection.modelId === model.id;

                                return (
                                  <div
                                    key={model.id}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      isCurrentDefault
                                        ? isDark ? 'bg-blue-950/20 border-blue-500/40' : 'bg-blue-50/50 border-blue-300'
                                        : isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50/60 border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Cpu className="w-4 h-4 text-blue-500 shrink-0" />
                                        <span className="font-bold text-xs truncate">{model.label || model.modelId}</span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setLocalConfig(prev => setAiConfigActiveSelection(prev, { endpointId: endpoint.id, modelId: model.id }))}
                                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                                            isCurrentDefault
                                              ? 'bg-blue-600 text-white'
                                              : isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                          }`}
                                        >
                                          {isCurrentDefault ? '✓ 当前默认' : '设为默认'}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleRemoveModel(endpoint.id, model.id)}
                                          disabled={endpoint.models.length <= 1}
                                          className="p-1 text-rose-500 hover:bg-rose-500/10 rounded disabled:opacity-30"
                                          title="删除此模型"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                      <div>
                                        <label className="block text-[11px] opacity-70 mb-0.5">模型展示名称</label>
                                        <input
                                          type="text"
                                          value={model.label}
                                          onChange={e => handleUpdateModel(endpoint.id, model.id, m => ({ ...m, label: e.target.value }))}
                                          placeholder="例如 deepseek-flash"
                                          className="w-full px-2.5 py-1.5 text-xs rounded border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[11px] opacity-70 mb-0.5">模型 ID (API)</label>
                                        <input
                                          type="text"
                                          value={model.modelId}
                                          onChange={e => handleUpdateModel(endpoint.id, model.id, m => ({ ...m, modelId: e.target.value }))}
                                          placeholder="如 deepseek-flash"
                                          className="w-full px-2.5 py-1.5 text-xs rounded border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 font-mono"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[11px] opacity-70 mb-0.5">上下文 Token (窗口)</label>
                                        <input
                                          type="number"
                                          value={model.contextWindow}
                                          onChange={e => handleUpdateModel(endpoint.id, model.id, m => ({ ...m, contextWindow: Math.max(1024, Number(e.target.value) || 1024) }))}
                                          step={10000}
                                          min={1024}
                                          className="w-full px-2.5 py-1.5 text-xs rounded border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[11px] opacity-70 mb-0.5">最大输出 Token</label>
                                        <input
                                          type="number"
                                          value={model.maxTokens || 384000}
                                          onChange={e => handleUpdateModel(endpoint.id, model.id, m => ({ ...m, maxTokens: Math.max(256, Number(e.target.value) || 384000) }))}
                                          step={10000}
                                          min={256}
                                          max={1000000}
                                          className="w-full px-2.5 py-1.5 text-xs rounded border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700"
                                        />
                                      </div>
                                    </div>

                                    {/* Temperature Slider & Thinking Configuration */}
                                    <div className={`mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-3 text-xs ${
                                      isDark ? 'border-zinc-800' : 'border-slate-200'
                                    }`}>
                                      <div className="flex items-center gap-2 min-w-[200px]">
                                        <span className="text-[11px] opacity-70">Temperature ({model.temperature}):</span>
                                        <input
                                          type="range"
                                          value={model.temperature}
                                          onChange={e => handleUpdateModel(endpoint.id, model.id, m => ({ ...m, temperature: Number(e.target.value) }))}
                                          min={0}
                                          max={1.5}
                                          step={0.1}
                                          className="w-24 accent-blue-600"
                                        />
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                          <input
                                            type="checkbox"
                                            checked={model.thinkingAvailable}
                                            onChange={e => handleUpdateModel(endpoint.id, model.id, m => ({
                                              ...m,
                                              thinkingAvailable: e.target.checked,
                                              thinkingEnabled: e.target.checked ? m.thinkingEnabled : false
                                            }))}
                                            className="rounded accent-blue-600"
                                          />
                                          <span className="font-semibold text-[11px]">支持思考/推理参数 (Thinking)</span>
                                        </label>
                                      </div>

                                      {model.thinkingAvailable && (
                                        <div className="flex items-center gap-3">
                                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                            <input
                                              type="checkbox"
                                              checked={model.thinkingEnabled}
                                              onChange={e => handleUpdateModel(endpoint.id, model.id, m => ({ ...m, thinkingEnabled: e.target.checked }))}
                                              className="rounded accent-blue-600"
                                            />
                                            <span className="text-[11px]">默认开启思考</span>
                                          </label>

                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] opacity-70">强度:</span>
                                            <select
                                              value={model.reasoningEffort || 'medium'}
                                              onChange={e => handleUpdateModel(endpoint.id, model.id, m => ({ ...m, reasoningEffort: e.target.value as AiReasoningEffort }))}
                                              className="px-2 py-0.5 text-xs rounded border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700"
                                            >
                                              {REASONING_EFFORT_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                  {opt.label}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* TAB 2: SYSTEM PROMPT */}
          {activeTab === 'prompt' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold tracking-tight">AI 助手系统提示词</h4>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    系统提示词指导 AI 对话风格与本工具独有语法的认知，保存后即刻生效
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleResetSystemPrompt}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>恢复系统默认</span>
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  rows={16}
                  placeholder="请输入系统提示词..."
                  className="w-full p-3.5 text-xs font-mono rounded-xl border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                isDark ? 'bg-zinc-900/50 border-zinc-800 text-zinc-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="font-bold text-blue-500 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>排版工具特有语法速记说明</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] opacity-80 leading-relaxed">
                  <li><strong>强制分页</strong>：独占一行的 <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">&lt;!-- pagebreak --&gt;</code></li>
                  <li><strong>表格题注</strong>：表格前一行的 <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">&lt;!-- caption: 题注说明 --&gt;</code></li>
                  <li><strong>图片宽高</strong>：<code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">![图示](@images/id)&#123;w=500&#125;</code></li>
                  <li><strong>矢量图表</strong>：支持标准的 <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">```mermaid</code> 代码块，支持 <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">&#123;theme=custom w=500 align=center&#125;</code></li>
                  <li><strong>数学公式</strong>：行内 <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">$E = mc^2$</code> 与独立 <code className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono">$$...$$</code> LaTeX 公式</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: QUICK PROMPTS */}
          {activeTab === 'quick-prompts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-bold tracking-tight">快捷短语栏管理</h4>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                    配置悬浮聊天窗底部的快捷操作。若短语列表为空，聊天窗将自动隐藏此栏。
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetQuickPrompts}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>恢复默认短语</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearQuickPrompts}
                    disabled={quickPrompts.length === 0}
                    className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清空短语</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddQuickPrompt}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>添加短语</span>
                  </button>
                </div>
              </div>

              {quickPrompts.length === 0 ? (
                <div className={`p-8 rounded-xl border text-center space-y-2 ${
                  isDark ? 'bg-zinc-900/30 border-zinc-800 text-zinc-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}>
                  <MessageSquareQuote className="w-8 h-8 mx-auto opacity-40 text-blue-500" />
                  <div className="text-xs font-bold">快捷短语列表已清空</div>
                  <div className="text-[11px] opacity-70 max-w-sm mx-auto">
                    当前没有配置任何快捷短语，AI 助手的聊天浮窗将不再展示底部快捷短语栏。点击右上角“添加短语”或“恢复默认短语”即可重新开启。
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {quickPrompts.map((qp, index) => (
                    <div 
                      key={qp.id}
                      className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                        isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono shrink-0">
                            #{index + 1}
                          </span>
                          <input
                            type="text"
                            value={qp.label}
                            onChange={e => handleUpdateQuickPrompt(qp.id, 'label', e.target.value)}
                            placeholder="短语按钮标签，例如：润色正文技术规范"
                            className="w-full px-2.5 py-1 text-xs font-bold rounded border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveQuickPrompt(qp.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                          title="删除此短语"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <textarea
                          value={qp.prompt}
                          onChange={e => handleUpdateQuickPrompt(qp.id, 'prompt', e.target.value)}
                          rows={2}
                          placeholder="点击该短语时直接向 AI 发送的完整提示词内容..."
                          className="w-full p-2 text-xs rounded border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500 leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className={`px-5 py-3.5 border-t flex items-center justify-end gap-3 ${
          isDark ? 'bg-[#181818] border-[#262626]' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              isDark ? 'border-zinc-700 hover:bg-zinc-800 text-zinc-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
            }`}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>保存并生效</span>
          </button>
        </div>

      </div>
    </div>
  );
};
