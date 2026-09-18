// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfig } from '../../types/ai';
import { AiSettingsModal } from './AiSettingsModal';

const configWithKey = (apiKey: string): AiConfig => ({
  endpoints: [{
    id: 'endpoint-test',
    name: 'Test',
    endpoint: 'https://example.test/chat',
    apiKey,
    models: [{
      id: 'model-test',
      label: 'Test model',
      modelId: 'test-model',
      contextWindow: 1000,
      temperature: 0.5,
      thinkingAvailable: false,
      thinkingEnabled: false,
      reasoningEffort: 'medium',
    }],
  }],
  activeSelection: { endpointId: 'endpoint-test', modelId: 'model-test' },
});

describe('AiSettingsModal config synchronization', () => {
  const roots: ReturnType<typeof createRoot>[] = [];

  afterEach(() => {
    roots.forEach(root => root.unmount());
    roots.length = 0;
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows a decrypted API key that arrives after the modal mounts', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const commonProps = {
      onClose: vi.fn(),
      onConfigChange: vi.fn(),
      isDark: false,
    };

    await act(async () => root.render(
      <AiSettingsModal {...commonProps} isOpen={false} config={configWithKey('')} />,
    ));
    await act(async () => root.render(
      <AiSettingsModal {...commonProps} isOpen config={configWithKey('sk-restored')} />,
    ));

    expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe('sk-restored');
    expect(container.textContent).toContain('已配置 Key');
  });

  it('refreshes the visible modal when decrypted config resolves asynchronously', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const commonProps = {
      isOpen: true,
      onClose: vi.fn(),
      onConfigChange: vi.fn(),
      isDark: false,
    };

    await act(async () => root.render(
      <AiSettingsModal {...commonProps} config={configWithKey('')} />,
    ));
    await act(async () => root.render(
      <AiSettingsModal {...commonProps} config={configWithKey('sk-late')} />,
    ));

    expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe('sk-late');
  });
});