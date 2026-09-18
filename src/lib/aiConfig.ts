import { AiConfig, AiEndpointConfig, AiModelConfig, AiQuickPrompt, AiRequestConfig } from '../types/ai';
import { DEFAULT_SYSTEM_PROMPT } from '../utils/aiAssistantService';
import { loadApiKeys, saveApiKeys } from './aiSecretStore';

const AI_CONFIG_STORAGE_KEY = 'sangdoccraft_ai_config';
export const AI_SYSTEM_PROMPT_KEY = 'sangdoccraft_ai_system_prompt';
export const AI_QUICK_PROMPTS_KEY = 'sangdoccraft_ai_quick_prompts';

export const DEFAULT_QUICK_PROMPTS: AiQuickPrompt[] = [
  { id: 'qp-1', label: '规范表格与题注', prompt: '请检查当前文档中的所有表格，若缺少表格题注，请按照 <!-- caption: 说明文字 --> 规范为其补充准确生动的题注。' },
  { id: 'qp-2', label: '润色正文技术规范', prompt: '请对我当前文档的正文进行专业技术文档润色，提升辞藻严谨度与工程规范感，保持格式清晰。' },
  { id: 'qp-3', label: '调整科技蓝风格', prompt: '请帮我将当前文档的主题风格调整为商务科技蓝：主色 #0369a1，强调色 #0284c7，正文字号 14px，开启首行缩进与一级标题分页。' }
];

export const DEFAULT_AI_CONFIG: AiConfig = {
  endpoints: [
    {
      id: 'endpoint-deepseek',
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: '',
      models: [
        {
          id: 'model-deepseek-flash',
          label: 'deepseek-flash',
          modelId: 'deepseek-flash',
          contextWindow: 1000000,
          maxTokens: 384000,
          temperature: 0.7,
          thinkingAvailable: false,
          thinkingEnabled: false,
          reasoningEffort: 'medium'
        },
        {
          id: 'model-deepseek-v4-pro',
          label: 'deepseek-v4-pro',
          modelId: 'deepseek-v4-pro',
          contextWindow: 1000000,
          maxTokens: 384000,
          temperature: 0.6,
          thinkingAvailable: true,
          thinkingEnabled: true,
          reasoningEffort: 'high'
        }
      ]
    },
    {
      id: 'endpoint-openai',
      name: 'OpenAI 兼容端点',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      models: [
        {
          id: 'model-gpt-4o',
          label: 'GPT-4o',
          modelId: 'gpt-4o',
          contextWindow: 128000,
          maxTokens: 16384,
          temperature: 0.7,
          thinkingAvailable: false,
          thinkingEnabled: false,
          reasoningEffort: 'medium'
        },
        {
          id: 'model-gpt-4o-mini',
          label: 'GPT-4o mini',
          modelId: 'gpt-4o-mini',
          contextWindow: 128000,
          maxTokens: 16384,
          temperature: 0.7,
          thinkingAvailable: false,
          thinkingEnabled: false,
          reasoningEffort: 'medium'
        }
      ]
    }
  ],
  activeSelection: {
    endpointId: 'endpoint-deepseek',
    modelId: 'model-deepseek-flash'
  }
};

export function loadAiConfig(): AiConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    if (!Array.isArray(parsed.endpoints) || parsed.endpoints.length === 0) {
      return DEFAULT_AI_CONFIG;
    }
    return normalizeAiConfig(parsed as AiConfig, false);
  } catch (error) {
    console.error('Failed to load AI config from localStorage:', error);
    return DEFAULT_AI_CONFIG;
  }
}

export async function loadAiConfigWithSecrets(): Promise<AiConfig> {
  const config = loadAiConfig();
  try {
    const apiKeys = await loadApiKeys();
    return {
      ...config,
      endpoints: config.endpoints.map(endpoint => ({ ...endpoint, apiKey: apiKeys.get(endpoint.id) || '' }))
    };
  } catch (error) {
    console.error('Failed to decrypt AI API keys:', error);
    return config;
  }
}

let pendingConfigSave = Promise.resolve();

export function saveAiConfig(config: AiConfig): Promise<void> {
  const configSnapshot = structuredClone(config);
  pendingConfigSave = pendingConfigSave.then(async () => {
  try {
    const normalized = normalizeAiConfig(configSnapshot);
    await saveApiKeys(new Map(normalized.endpoints.filter(endpoint => endpoint.apiKey).map(endpoint => [endpoint.id, endpoint.apiKey])));
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      ...normalized,
      endpoints: normalized.endpoints.map(endpoint => ({ ...endpoint, apiKey: '' }))
    }));
  } catch (error) {
    console.error('Failed to save AI config to localStorage:', error);
  }
  });
  return pendingConfigSave;
}

export function loadAiSystemPrompt(): string {
  const saved = localStorage.getItem(AI_SYSTEM_PROMPT_KEY);
  if (saved === null) {
    localStorage.setItem(AI_SYSTEM_PROMPT_KEY, DEFAULT_SYSTEM_PROMPT);
    return DEFAULT_SYSTEM_PROMPT;
  }
  return saved;
}

export function saveAiSystemPrompt(prompt: string): void {
  localStorage.setItem(AI_SYSTEM_PROMPT_KEY, prompt);
}

export function resetAiSystemPrompt(): string {
  localStorage.setItem(AI_SYSTEM_PROMPT_KEY, DEFAULT_SYSTEM_PROMPT);
  return DEFAULT_SYSTEM_PROMPT;
}

export function loadAiQuickPrompts(): AiQuickPrompt[] {
  const saved = localStorage.getItem(AI_QUICK_PROMPTS_KEY);
  if (saved === null) {
    localStorage.setItem(AI_QUICK_PROMPTS_KEY, JSON.stringify(DEFAULT_QUICK_PROMPTS));
    return DEFAULT_QUICK_PROMPTS;
  }
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveAiQuickPrompts(prompts: AiQuickPrompt[]): void {
  localStorage.setItem(AI_QUICK_PROMPTS_KEY, JSON.stringify(prompts));
}

export function resetAiQuickPrompts(): AiQuickPrompt[] {
  localStorage.setItem(AI_QUICK_PROMPTS_KEY, JSON.stringify(DEFAULT_QUICK_PROMPTS));
  return DEFAULT_QUICK_PROMPTS;
}

export function normalizeAiConfig(config: AiConfig, preserveApiKeys = true): AiConfig {
  const endpoints = (config.endpoints || []).map((ep, epIdx) => {
    let rawModels = ep.models || [];
    // If it's DeepSeek endpoint and lacks deepseek-flash, upgrade models
    if ((ep.id === 'endpoint-deepseek' || ep.name.toLowerCase().includes('deepseek')) && !rawModels.some(m => m.modelId === 'deepseek-flash')) {
      rawModels = [
        {
          id: 'model-deepseek-flash',
          label: 'deepseek-flash',
          modelId: 'deepseek-flash',
          contextWindow: 1000000,
          maxTokens: 384000,
          temperature: 0.7,
          thinkingAvailable: false,
          thinkingEnabled: false,
          reasoningEffort: 'medium'
        },
        {
          id: 'model-deepseek-v4-pro',
          label: 'deepseek-v4-pro',
          modelId: 'deepseek-v4-pro',
          contextWindow: 1000000,
          maxTokens: 384000,
          temperature: 0.6,
          thinkingAvailable: true,
          thinkingEnabled: true,
          reasoningEffort: 'high'
        },
        ...rawModels
      ];
    }

    return {
      id: ep.id || `ep-${epIdx + 1}-${Date.now()}`,
      name: ep.name || `端点 ${epIdx + 1}`,
      endpoint: ep.endpoint || '',
      apiKey: preserveApiKeys ? ep.apiKey || '' : '',
      models: rawModels.map((m, mIdx) => ({
        id: m.id || `model-${mIdx + 1}-${Date.now()}`,
        label: m.label || m.modelId || `模型 ${mIdx + 1}`,
        modelId: m.modelId || 'deepseek-flash',
        contextWindow: Number(m.contextWindow) || 1000000,
        maxTokens: m.maxTokens !== undefined ? Number(m.maxTokens) : undefined,
        temperature: typeof m.temperature === 'number' ? m.temperature : 0.7,
        thinkingAvailable: Boolean(m.thinkingAvailable),
        thinkingEnabled: Boolean(m.thinkingEnabled),
        reasoningEffort: m.reasoningEffort || 'medium'
      }))
    };
  });

  if (endpoints.length === 0) {
    return DEFAULT_AI_CONFIG;
  }

  // Ensure every endpoint has at least 1 model
  endpoints.forEach((ep) => {
    if (ep.models.length === 0) {
      ep.models.push({
        id: `model-1-${Date.now()}`,
        label: 'deepseek-flash',
        modelId: 'deepseek-flash',
        contextWindow: 1000000,
        maxTokens: 384000,
        temperature: 0.7,
        thinkingAvailable: false,
        thinkingEnabled: false,
        reasoningEffort: 'medium'
      });
    }
  });

  let activeSelection = config.activeSelection;
  const validEndpoint = endpoints.find(e => e.id === activeSelection?.endpointId);
  if (!validEndpoint) {
    activeSelection = {
      endpointId: endpoints[0].id,
      modelId: endpoints[0].models[0].id
    };
  } else {
    const validModel = validEndpoint.models.find(m => m.id === activeSelection?.modelId);
    if (!validModel) {
      activeSelection = {
        endpointId: validEndpoint.id,
        modelId: validEndpoint.models[0].id
      };
    }
  }

  return {
    endpoints,
    activeSelection
  };
}

export function resolveAiModelOption(config: AiConfig) {
  const normalized = normalizeAiConfig(config);
  const endpoint = normalized.endpoints.find(e => e.id === normalized.activeSelection?.endpointId) || normalized.endpoints[0];
  if (!endpoint) return null;
  const model = endpoint.models.find(m => m.id === normalized.activeSelection?.modelId) || endpoint.models[0];
  if (!model) return null;

  return {
    endpoint,
    model,
    selection: {
      endpointId: endpoint.id,
      modelId: model.id
    }
  };
}

export function setAiConfigActiveSelection(config: AiConfig, selection: { endpointId: string; modelId: string }): AiConfig {
  return {
    ...config,
    activeSelection: selection
  };
}

export function toAiRequestConfig(config: AiConfig): AiRequestConfig | null {
  const option = resolveAiModelOption(config);
  if (!option) return null;

  return {
    endpoint: option.endpoint.endpoint,
    apiKey: option.endpoint.apiKey,
    modelId: option.model.modelId,
    temperature: option.model.temperature,
    maxTokens: option.model.maxTokens,
    thinkingAvailable: option.model.thinkingAvailable,
    thinkingEnabled: option.model.thinkingEnabled,
    reasoningEffort: option.model.reasoningEffort
  };
}
