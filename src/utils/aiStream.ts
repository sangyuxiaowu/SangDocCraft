import {
  AiChatMessage,
  AiRequestConfig,
  AiTokenUsage,
  AiToolDefinition,
  AiToolErrorKind,
  AiToolExecutionError,
  AiToolRuntime
} from '../types/ai';

export { AiToolExecutionError };
export type { AiToolErrorKind };

function buildThinkingPayload(config: AiRequestConfig) {
  if (!config.thinkingAvailable) {
    return {};
  }

  return {
    thinking: {
      type: config.thinkingEnabled ? 'enabled' : 'disabled'
    },
    reasoning_effort: config.thinkingEnabled
      ? (config.reasoningEffort ?? 'medium')
      : undefined
  };
}

export interface StreamConversationOptions {
  config: AiRequestConfig;
  messages: AiChatMessage[];
  tools?: AiToolRuntime[];
  temperature?: number;
  maxRounds?: number;
  signal?: AbortSignal;
  onReasoningChunk?: (chunk: string) => void;
  onTextChunk?: (chunk: string) => void;
  onToolCall?: (toolCall: { id: string; name: string; arguments: string }) => void;
  onToolResult?: (toolResult: { id: string; name: string; result: string; isError: boolean }) => void;
}

export interface StreamConversationResult {
  assistantMessage: AiChatMessage;
  transcript: AiChatMessage[];
}

interface StreamingToolCall {
  id: string;
  name: string;
  arguments: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function normalizeUsage(rawUsage: unknown): AiTokenUsage | undefined {
  if (!isRecord(rawUsage)) {
    return undefined;
  }

  const promptTokens = Number(rawUsage.prompt_tokens ?? rawUsage.input_tokens ?? rawUsage.promptTokens);
  const completionTokens = Number(rawUsage.completion_tokens ?? rawUsage.output_tokens ?? rawUsage.completionTokens);
  const totalTokens = Number(rawUsage.total_tokens ?? rawUsage.totalTokens);

  const usage: AiTokenUsage = {
    ...(Number.isFinite(promptTokens) && promptTokens >= 0 ? { promptTokens } : {}),
    ...(Number.isFinite(completionTokens) && completionTokens >= 0 ? { completionTokens } : {}),
    ...(Number.isFinite(totalTokens) && totalTokens >= 0 ? { totalTokens } : {})
  };

  if (!Object.keys(usage).length) {
    return undefined;
  }

  if (usage.totalTokens === undefined && usage.promptTokens !== undefined && usage.completionTokens !== undefined) {
    usage.totalTokens = usage.promptTokens + usage.completionTokens;
  }

  return usage;
}

const DEFAULT_TOOL_TIMEOUT_MS = 10_000;

const TOOL_ERROR_PREFIX_MAP: Record<AiToolErrorKind, string> = {
  user_cancelled: '用户取消',
  invalid_arguments: '参数格式错误',
  system_failure: '系统失败',
  timeout: '执行超时'
};

function formatToolErrorMessage(kind: AiToolErrorKind, message: string) {
  const normalizedMessage = message.trim() || '工具执行失败';
  return `[${TOOL_ERROR_PREFIX_MAP[kind]}] ${normalizedMessage}`;
}

function normalizeToolResult(result: string) {
  const normalizedResult = result || '';
  if (normalizedResult.trimStart().startsWith('用户取消')) {
    return {
      result: formatToolErrorMessage('user_cancelled', normalizedResult),
      isError: true
    };
  }

  return {
    result: normalizedResult,
    isError: false
  };
}

function normalizeToolError(error: unknown, fallbackKind: AiToolErrorKind = 'system_failure') {
  const kind = error instanceof AiToolExecutionError ? error.kind : fallbackKind;
  const message = error instanceof Error ? error.message : String(error || '工具执行失败');
  return formatToolErrorMessage(kind, message);
}

function getToolTimeoutMs(runtime: AiToolRuntime) {
  if (runtime.requiresUserConfirmation) {
    return 0;
  }

  return runtime.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
}

export async function executeAiToolRuntime(runtime: AiToolRuntime, args: Record<string, unknown>) {
  const timeoutMs = getToolTimeoutMs(runtime);
  if (!timeoutMs || timeoutMs <= 0) {
    return runtime.handler(args);
  }

  const toolName = runtime.definition.function.name;
  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      runtime.onTimeout?.();
      reject(new AiToolExecutionError(
        'timeout',
        `工具执行超时：${toolName} 在 ${Math.ceil(timeoutMs / 1000)} 秒内未返回，为避免阻塞已停止等待。`
      ));
    }, timeoutMs);

    runtime.handler(args)
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function toApiMessages(messages: AiChatMessage[]) {
  return messages.map(message => {
    const reasoningPayload = message.role === 'assistant' && message.reasoning
      ? { reasoning_content: message.reasoning }
      : {};

    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId,
        name: message.name
      };
    }

    if (message.toolCalls?.length) {
      return {
        role: message.role,
        content: message.content,
        ...reasoningPayload,
        tool_calls: message.toolCalls.map(toolCall => ({
          id: toolCall.id,
          type: toolCall.type,
          function: toolCall.function
        }))
      };
    }

    return {
      role: message.role,
      content: message.content,
      ...reasoningPayload
    };
  });
}

function parseReasoningChunk(delta: Record<string, unknown>) {
  return getStringValue(delta, 'reasoning_content')
    || getStringValue(delta, 'reasoning')
    || getStringValue(delta, 'reasoningContent')
    || getStringValue(delta, 'reasoning_text');
}

function parseStreamingDelta(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return {};
  }

  const [firstChoice] = payload.choices;
  if (!isRecord(firstChoice) || !isRecord(firstChoice.delta)) {
    return {};
  }

  return firstChoice.delta;
}

function applyStreamingToolCallDelta(toolCalls: StreamingToolCall[], toolCallDelta: unknown) {
  if (!isRecord(toolCallDelta)) {
    return null;
  }

  const indexValue = Number(toolCallDelta.index ?? toolCalls.length);
  const index = Number.isInteger(indexValue) && indexValue >= 0 ? indexValue : toolCalls.length;
  const existing = toolCalls[index] || { id: '', name: '', arguments: '' };
  const functionDelta = isRecord(toolCallDelta.function) ? toolCallDelta.function : {};

  existing.id = getStringValue(toolCallDelta, 'id') || existing.id;
  existing.name = getStringValue(functionDelta, 'name') || existing.name;
  existing.arguments += getStringValue(functionDelta, 'arguments');
  toolCalls[index] = existing;

  return { index, toolCall: existing };
}

function normalizeToolCalls(toolCalls: StreamingToolCall[]) {
  return toolCalls
    .filter(toolCall => toolCall.name)
    .map((toolCall, index) => ({
      id: toolCall.id || `tool-${index}`,
      type: 'function' as const,
      function: {
        name: toolCall.name,
        arguments: toolCall.arguments || '{}'
      }
    }));
}

async function requestStream(options: StreamConversationOptions) {
  if (!options.config.apiKey || !options.config.endpoint) {
    throw new Error('AI 配置不完整，请先在设置中填写请求端点 (URL) 与 API Key。');
  }

  const thinkingPayload = buildThinkingPayload(options.config);

  const response = await fetch(options.config.endpoint, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.config.apiKey}`
    },
    body: JSON.stringify({
      model: options.config.modelId,
      messages: toApiMessages(options.messages),
      tools: options.tools?.map(tool => tool.definition),
      tool_choice: options.tools?.length ? 'auto' : undefined,
      stream: true,
      temperature: options.temperature ?? options.config.temperature ?? 0.7,
      ...(options.config.maxTokens ? { max_tokens: options.config.maxTokens } : {}),
      stream_options: {
        include_usage: true
      },
      ...thinkingPayload
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || `AI 请求失败，状态码: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('AI 流式响应不可用。');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let usage: AiTokenUsage | undefined;
  const toolCalls: StreamingToolCall[] = [];
  const emittedToolCallPayloads = new Map<string, string>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) {
        continue;
      }

      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') {
        continue;
      }

      try {
        const parsed: unknown = JSON.parse(payload);
        usage = normalizeUsage(isRecord(parsed) ? parsed.usage : undefined) || usage;
        const delta = parseStreamingDelta(parsed);
        const textChunk = getStringValue(delta, 'content');
        const reasoningChunk = parseReasoningChunk(delta);

        if (textChunk) {
          content += textChunk;
          options.onTextChunk?.(textChunk);
        }

        if (reasoningChunk) {
          reasoning += reasoningChunk;
          options.onReasoningChunk?.(reasoningChunk);
        }

        if (Array.isArray(delta.tool_calls)) {
          delta.tool_calls.forEach(toolCallDelta => {
            const appliedDelta = applyStreamingToolCallDelta(toolCalls, toolCallDelta);
            if (!appliedDelta) {
              return;
            }

            const { index, toolCall } = appliedDelta;
            const toolCallId = toolCall.id || `tool-${index}`;
            const toolCallArguments = toolCall.arguments || '{}';
            if (toolCall.name && emittedToolCallPayloads.get(toolCallId) !== toolCallArguments) {
              emittedToolCallPayloads.set(toolCallId, toolCallArguments);
              options.onToolCall?.({
                id: toolCallId,
                name: toolCall.name,
                arguments: toolCallArguments
              });
            }
          });
        }
      } catch (error) {
        // Silently skip malformed chunks
      }
    }
  }

  return {
    content,
    reasoning,
    usage,
    toolCalls: normalizeToolCalls(toolCalls)
  };
}

interface ToolCallExecutionResult {
  completed: boolean;
  toolMessages: AiChatMessage[];
}

function isCompletedToolMessage(message: AiChatMessage | undefined) {
  return message?.role === 'tool'
    && message.toolStatus !== 'timeout'
    && message.toolRetryable !== true;
}

async function executeAssistantToolCalls(
  options: StreamConversationOptions,
  assistantMessage: AiChatMessage,
  existingToolMessages: AiChatMessage[] = []
): Promise<ToolCallExecutionResult> {
  const toolsByName = new Map((options.tools || []).map(tool => [tool.definition.function.name, tool]));
  const existingById = new Map(existingToolMessages.map(message => [message.toolCallId, message]));
  const toolMessages: AiChatMessage[] = [];
  const toolCalls = assistantMessage.toolCalls || [];
  const markdownEditCount = toolCalls.filter(toolCall => toolCall.function.name === 'edit_markdown_content').length;
  // get_document_state 已包含 get_document_summary 的全部字段，同批同时调用时跳过后者的重复执行。
  const hasDocumentState = toolCalls.some(toolCall => toolCall.function.name === 'get_document_state');

  if (markdownEditCount > 1) {
    const message = formatToolErrorMessage(
      'invalid_arguments',
      '同一批次仅允许一个 edit_markdown_content；请将多项正文修改合并到一次 operations 调用中。整批工具调用均未执行。'
    );
    for (const toolCall of toolCalls) {
      options.onToolCall?.({ id: toolCall.id, name: toolCall.function.name, arguments: toolCall.function.arguments });
      options.onToolResult?.({ id: toolCall.id, name: toolCall.function.name, result: message, isError: true });
      toolMessages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        content: message,
        toolStatus: 'error',
        toolRetryable: false
      });
    }
    return { completed: true, toolMessages };
  }

  for (const toolCall of toolCalls) {
    const existing = existingById.get(toolCall.id);
    if (isCompletedToolMessage(existing)) {
      toolMessages.push(existing!);
      continue;
    }

    const runtime = toolsByName.get(toolCall.function.name);
    const toolName = toolCall.function.name;
    options.onToolCall?.({ id: toolCall.id, name: toolName, arguments: toolCall.function.arguments });
    if (!runtime) {
      const missingResult = `未找到工具：${toolName}`;
      options.onToolResult?.({ id: toolCall.id, name: toolName, result: missingResult, isError: true });
      toolMessages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolName,
        content: missingResult,
        toolStatus: 'error'
      });
      return { completed: false, toolMessages };
    }

    if (hasDocumentState && toolName === 'get_document_summary') {
      const skippedResult = 'get_document_state 已包含 get_document_summary 的全部字段，本次重复调用已跳过。';
      options.onToolResult?.({ id: toolCall.id, name: toolName, result: skippedResult, isError: false });
      toolMessages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolName,
        content: skippedResult,
        toolStatus: 'success',
        toolRetryable: false
      });
      continue;
    }

    try {
      let parsedArgs: Record<string, unknown>;
      try {
        parsedArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
      } catch (error) {
        throw new AiToolExecutionError('invalid_arguments', error instanceof Error ? error.message : '工具参数不是有效 JSON。');
      }

      const result = await executeAiToolRuntime(runtime, parsedArgs);
      const normalizedResult = normalizeToolResult(result);
      options.onToolResult?.({ id: toolCall.id, name: toolName, result: normalizedResult.result, isError: normalizedResult.isError });
      toolMessages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolName,
        content: normalizedResult.result,
        toolStatus: normalizedResult.isError ? 'error' : 'success',
        toolRetryable: false
      });
    } catch (error) {
      const message = normalizeToolError(error);
      const errorKind = error instanceof AiToolExecutionError ? error.kind : 'system_failure';
      const retryable = errorKind === 'timeout' || errorKind === 'system_failure';
      options.onToolResult?.({ id: toolCall.id, name: toolName, result: message, isError: true });
      toolMessages.push({
        role: 'tool',
        toolCallId: toolCall.id,
        name: toolName,
        content: message,
        toolStatus: errorKind === 'timeout' ? 'timeout' : 'error',
        toolRetryable: retryable
      });
      if (retryable) {
        return { completed: false, toolMessages };
      }
    }
  }

  return { completed: true, toolMessages };
}

export async function streamConversation(options: StreamConversationOptions, round = 0): Promise<StreamConversationResult> {
  const maxRounds = options.maxRounds ?? 5;
  const baseMessages = options.messages;

  const streamed = await requestStream({
    ...options,
    messages: baseMessages
  });

  const assistantMessage: AiChatMessage = {
    role: 'assistant',
    content: streamed.content,
    reasoning: streamed.reasoning,
    usage: streamed.usage,
    ...(streamed.toolCalls.length > 0 ? { toolCalls: streamed.toolCalls } : {})
  };

  if (streamed.toolCalls.length === 0 || round >= maxRounds) {
    return {
      assistantMessage,
      transcript: [...baseMessages, assistantMessage]
    };
  }

  const execution = await executeAssistantToolCalls(options, assistantMessage);
  const transcript = [...baseMessages, assistantMessage, ...execution.toolMessages];
  if (!execution.completed) {
    return { assistantMessage, transcript };
  }

  return streamConversation({
    ...options,
    messages: transcript
  }, round + 1);
}

export async function retryPendingToolCalls(options: StreamConversationOptions): Promise<StreamConversationResult> {
  const assistantIndex = options.messages.findLastIndex(message => message.role === 'assistant' && message.toolCalls?.length);
  if (assistantIndex < 0) {
    throw new Error('没有可重试的工具调用。');
  }

  const assistantMessage = options.messages[assistantIndex];
  const existingToolMessages: AiChatMessage[] = [];
  for (let index = assistantIndex + 1; options.messages[index]?.role === 'tool'; index++) {
    existingToolMessages.push(options.messages[index]);
  }

  const execution = await executeAssistantToolCalls(options, assistantMessage, existingToolMessages);
  const transcript = [
    ...options.messages.slice(0, assistantIndex),
    assistantMessage,
    ...execution.toolMessages
  ];
  if (!execution.completed) {
    return { assistantMessage, transcript };
  }

  return streamConversation({ ...options, messages: transcript });
}
