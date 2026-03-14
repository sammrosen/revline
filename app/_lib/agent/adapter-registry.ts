/**
 * Agent Adapter Registry
 *
 * Extensible registries for AI completion and channel delivery adapters.
 * Adding a new provider = one entry here. Zero engine changes.
 *
 * STANDARDS:
 * - Agnostic: engine resolves adapters by key, never branches on provider names
 * - Extensible: new providers register here, not in engine.ts
 */

import { OpenAIAdapter, AnthropicAdapter, TwilioAdapter } from '@/app/_lib/integrations';
import type { ChatCompletionParams, ChatCompletionResult } from '@/app/_lib/integrations';
import type { IntegrationResult } from '@/app/_lib/types';

// =============================================================================
// AI ADAPTER REGISTRY
// =============================================================================

interface AIAdapter {
  chatCompletion(params: ChatCompletionParams): Promise<IntegrationResult<ChatCompletionResult>>;
}

interface AIAdapterEntry {
  forWorkspace(workspaceId: string): Promise<AIAdapter | null>;
  label: string;
  defaultModel: string;
}

const AI_REGISTRY: Record<string, AIAdapterEntry> = {
  OPENAI: {
    forWorkspace: (id) => OpenAIAdapter.forWorkspace(id),
    label: 'OpenAI',
    defaultModel: 'gpt-4.1-mini',
  },
  ANTHROPIC: {
    forWorkspace: (id) => AnthropicAdapter.forWorkspace(id),
    label: 'Anthropic',
    defaultModel: 'claude-sonnet-4-6',
  },
};

export function resolveAI(key: string): AIAdapterEntry | null {
  return AI_REGISTRY[key.toUpperCase()] ?? null;
}

export function getDefaultModelForProvider(aiIntegration: string): string {
  const entry = AI_REGISTRY[aiIntegration.toUpperCase()];
  return entry?.defaultModel ?? 'unknown';
}

export function getRegisteredAIProviders(): string[] {
  return Object.keys(AI_REGISTRY);
}

// =============================================================================
// CHANNEL ADAPTER REGISTRY
// =============================================================================

interface ChannelAdapterEntry {
  forWorkspace(workspaceId: string): Promise<ChannelAdapter | null>;
  label: string;
  /** Lead property key that holds the contact's address for this channel */
  contactField: string;
}

interface ChannelAdapter {
  sendMessage(fromAddress: string, toAddress: string, body: string): Promise<IntegrationResult<unknown>>;
}

class TwilioChannelAdapter implements ChannelAdapter {
  constructor(private adapter: InstanceType<typeof TwilioAdapter>) {}

  async sendMessage(fromAddress: string, toAddress: string, body: string): Promise<IntegrationResult<unknown>> {
    const fromKey = this.adapter.getPhoneKeyByNumber(fromAddress);
    return this.adapter.sendSms({ to: toAddress, body, from: fromKey });
  }
}

const CHANNEL_REGISTRY: Record<string, ChannelAdapterEntry> = {
  TWILIO: {
    forWorkspace: async (workspaceId: string) => {
      const adapter = await TwilioAdapter.forWorkspace(workspaceId);
      if (!adapter) return null;
      return new TwilioChannelAdapter(adapter);
    },
    label: 'Twilio',
    contactField: 'phone',
  },
};

export function resolveChannel(key: string): ChannelAdapterEntry | null {
  return CHANNEL_REGISTRY[key.toUpperCase()] ?? null;
}

export function getContactFieldForChannel(key: string): string | null {
  const entry = CHANNEL_REGISTRY[key.toUpperCase()];
  return entry?.contactField ?? null;
}

export function getRegisteredChannelProviders(): string[] {
  return Object.keys(CHANNEL_REGISTRY);
}

export type { AIAdapter, AIAdapterEntry, ChannelAdapter, ChannelAdapterEntry };
