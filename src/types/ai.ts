import { DocumentHistoryEntry, DocumentSettings, DocumentTheme } from '../types';

export type AiReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';

export interface AiModelConfig {
  id: string;
  label: string;
  modelId: string;
  contextWindow: number;
  maxTokens?: number;
  temperature: number;
  thinkingAvailable: boolean;
  thinkingEnabled: boolean;
  reasoningEffort: AiReasoningEffort;
}

export interface AiEndpointConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  models: AiModelConfig[];
}

export interface AiActiveSelection {
  endpointId: string;
  modelId: string;
}

export interface AiConfig {
  endpoints: AiEndpointConfig[];
  activeSelection?: AiActiveSelection;
}

export interface AiRequestConfig {
  endpoint: string;
  apiKey: string;
  modelId: string;
  maxTokens?: number;
  temperature?: number;
  thinkingAvailable?: boolean;
  thinkingEnabled?: boolean;
  reasoningEffort?: AiReasoningEffort;
}

export interface AiQuickPrompt {
  id: string;
  label: string;
  prompt: string;
}

export interface DocumentChatSession {
  id: string;
  documentId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AiChatMessage[];
}

export interface AiTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  reasoning?: string;
  usage?: AiTokenUsage;
  name?: string;
  toolCallId?: string;
  toolStatus?: 'success' | 'error' | 'timeout';
  toolRetryable?: boolean;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface AiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiToolRuntime {
  definition: AiToolDefinition;
  handler: (args: Record<string, unknown>) => Promise<string>;
  timeoutMs?: number;
  requiresUserConfirmation?: boolean;
  onTimeout?: () => void;
}

export type AiToolErrorKind = 'user_cancelled' | 'invalid_arguments' | 'system_failure' | 'timeout';

export class AiToolExecutionError extends Error {
  kind: AiToolErrorKind;

  constructor(kind: AiToolErrorKind, message: string) {
    super(message);
    this.name = 'AiToolExecutionError';
    this.kind = kind;
  }
}

// Diff Review Types for VS Code / Git-like review in Editor
export interface DiffLine {
  type: 'same' | 'added' | 'removed';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  id: string;
  type: 'unchanged' | 'change';
  lines: DiffLine[];
  originalLines: string[];
  modifiedLines: string[];
  oldStartLine: number;
  newStartLine: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface DiffReviewSession {
  id: string;
  originalText: string;
  modifiedText: string;
  description?: string;
  hunks: DiffHunk[];
  createdAt: string;
}
