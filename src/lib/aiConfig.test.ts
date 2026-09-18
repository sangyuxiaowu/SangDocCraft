// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AiConfig } from '../types/ai';
import { loadAiConfigWithSecrets, saveAiConfig } from './aiConfig';

describe('AI config secret storage', () => {
  beforeEach(() => localStorage.clear());

  it('stores API keys encrypted outside localStorage and restores them', async () => {
    const config: AiConfig = {
      endpoints: [{
        id: 'endpoint-test',
        name: 'Test',
        endpoint: 'https://example.test/chat',
        apiKey: 'sk-plain-secret',
        models: [{
          id: 'model-test',
          label: 'Test model',
          modelId: 'test-model',
          contextWindow: 1000,
          temperature: 0.5,
          thinkingAvailable: true,
          thinkingEnabled: true,
          reasoningEffort: 'high',
        }],
      }],
      activeSelection: { endpointId: 'endpoint-test', modelId: 'model-test' },
    };

    await saveAiConfig(config);

    expect(localStorage.getItem('sangdoccraft_ai_config')).not.toContain('sk-plain-secret');
    const restored = await loadAiConfigWithSecrets();
    expect(restored.endpoints[0].apiKey).toBe('sk-plain-secret');
  });
});