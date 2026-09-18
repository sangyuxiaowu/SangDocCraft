import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiToolExecutionError, type AiChatMessage, type AiToolRuntime } from '../types/ai';
import { executeAiToolRuntime, retryPendingToolCalls, streamConversation } from './aiStream';

function streamResponse(delta: Record<string, unknown>) {
  const body = `data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`;
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function runtime(name: string, handler: AiToolRuntime['handler']): AiToolRuntime {
  return {
    definition: {
      type: 'function',
      function: { name, description: name, parameters: { type: 'object', properties: {} } },
    },
    handler,
  };
}

const config = {
  endpoint: 'https://example.test/chat',
  apiKey: 'test-key',
  modelId: 'test-model',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AI tool execution flow', () => {
  it('runs tool calls in order and waits for each result', async () => {
    let finishFirst: ((value: string) => void) | undefined;
    const calls: string[] = [];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(streamResponse({
        tool_calls: [
          { index: 0, id: 'call-1', function: { name: 'first', arguments: '{}' } },
          { index: 1, id: 'call-2', function: { name: 'second', arguments: '{}' } },
        ],
      }))
      .mockResolvedValueOnce(streamResponse({ content: '完成' }));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = streamConversation({
      config,
      messages: [{ role: 'user', content: '执行工具' }],
      tools: [
        runtime('first', () => new Promise(resolve => {
          calls.push('first');
          finishFirst = resolve;
        })),
        runtime('second', async () => {
          calls.push('second');
          return 'second done';
        }),
      ],
    });

    await vi.waitFor(() => expect(finishFirst).toBeDefined());
    expect(calls).toEqual(['first']);

    finishFirst!('first done');
    const result = await resultPromise;

    expect(calls).toEqual(['first', 'second']);
    expect(result.assistantMessage.content).toBe('完成');
  });

  it('marks timed out tools with a timeout error', async () => {
    await expect(executeAiToolRuntime({
      ...runtime('slow', () => new Promise(() => undefined)),
      timeoutMs: 1,
    }, {})).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('continues later tool calls after an invalid argument result', async () => {
    const laterHandler = vi.fn(async () => 'latest state');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(streamResponse({
        tool_calls: [
          { index: 0, id: 'call-invalid', function: { name: 'edit', arguments: '{}' } },
          { index: 1, id: 'call-state', function: { name: 'state', arguments: '{}' } },
        ],
      }))
      .mockResolvedValueOnce(streamResponse({ content: '边界测试完成' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await streamConversation({
      config,
      messages: [{ role: 'user', content: '测试边界' }],
      tools: [
        runtime('edit', async () => {
          throw new AiToolExecutionError('invalid_arguments', 'replace 模式必须提供 range。');
        }),
        runtime('state', laterHandler),
      ],
    });

    expect(laterHandler).toHaveBeenCalledOnce();
    expect(result.transcript.filter(message => message.role === 'tool')).toMatchObject([
      { toolCallId: 'call-invalid', toolStatus: 'error', toolRetryable: false },
      { toolCallId: 'call-state', toolStatus: 'success' },
    ]);
    expect(result.assistantMessage.content).toBe('边界测试完成');
  });

  it('rejects an entire tool-call batch containing multiple Markdown editors', async () => {
    const editHandler = vi.fn(async () => 'edited');
    const stateHandler = vi.fn(async () => 'state');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(streamResponse({
        tool_calls: [
          { index: 0, id: 'edit-1', function: { name: 'edit_markdown_content', arguments: '{"operations":[]}' } },
          { index: 1, id: 'state-1', function: { name: 'state', arguments: '{}' } },
          { index: 2, id: 'edit-2', function: { name: 'edit_markdown_content', arguments: '{"operations":[]}' } },
        ],
      }))
      .mockResolvedValueOnce(streamResponse({ content: '已重新规划' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await streamConversation({
      config,
      messages: [{ role: 'user', content: '批量编辑' }],
      tools: [runtime('edit_markdown_content', editHandler), runtime('state', stateHandler)],
    });

    expect(editHandler).not.toHaveBeenCalled();
    expect(stateHandler).not.toHaveBeenCalled();
    expect(result.transcript.filter(message => message.role === 'tool')).toHaveLength(3);
    expect(result.transcript.filter(message => message.role === 'tool').every(message =>
      message.content.includes('整批工具调用均未执行') && message.toolRetryable === false
    )).toBe(true);
  });

  it('retries the failed tool without rerunning successful predecessors', async () => {
    const firstHandler = vi.fn(async () => 'first done');
    const secondHandler = vi.fn(async () => 'second done');
    const messages: AiChatMessage[] = [
      { role: 'system', content: 'system' },
      { role: 'user', content: '执行工具' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-1', type: 'function', function: { name: 'first', arguments: '{}' } },
          { id: 'call-2', type: 'function', function: { name: 'second', arguments: '{}' } },
        ],
      },
      { role: 'tool', toolCallId: 'call-1', name: 'first', content: 'first done', toolStatus: 'success' },
      { role: 'tool', toolCallId: 'call-2', name: 'second', content: '[系统失败] failed', toolStatus: 'error', toolRetryable: true },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse({ content: '恢复完成' })));

    const result = await retryPendingToolCalls({
      config,
      messages,
      tools: [runtime('first', firstHandler), runtime('second', secondHandler)],
    });

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledOnce();
    expect(result.transcript.filter(message => message.role === 'tool')).toMatchObject([
      { toolCallId: 'call-1', toolStatus: 'success' },
      { toolCallId: 'call-2', toolStatus: 'success' },
    ]);
    expect(result.assistantMessage.content).toBe('恢复完成');
  });
});
