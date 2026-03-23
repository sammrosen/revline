/**
 * OpenAI Integration Adapter
 * 
 * Handles OpenAI Chat Completions operations for a specific workspace.
 * This is a "dumb pipe" — it sends messages to the API and returns responses.
 * Conversation state management is handled by the agent engine (separate layer).
 * 
 * Secret names:
 * - "API Key" - Required for all API calls
 * 
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes credentials outside this module
 * - Uses official OpenAI SDK
 */

import { IntegrationType } from '@prisma/client';
import OpenAI from 'openai';
import { BaseIntegrationAdapter } from './base';
import { OpenAIMeta, IntegrationResult } from '@/app/_lib/types';

export const OPENAI_API_KEY_SECRET = 'API Key';

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
  role: 'developer' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Required when role is 'tool' — references the tool_call_id this responds to */
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  /** Override model from meta config */
  model?: string;
  /** Override temperature from meta config */
  temperature?: number;
  /** Override max tokens from meta config */
  maxTokens?: number;
  /** Tool definitions for function calling */
  tools?: ToolDefinition[];
  /** Control tool usage: 'auto', 'none', or specific function */
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface ChatCompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
  model: string;
}

export interface OpenAIModel {
  id: string;
  created: number;
  ownedBy: string;
}

// =============================================================================
// ADAPTER
// =============================================================================

/**
 * OpenAI adapter for workspace-scoped AI completions
 * 
 * @example
 * const adapter = await OpenAIAdapter.forWorkspace(workspaceId);
 * if (!adapter) return ApiResponse.configError();
 * 
 * const result = await adapter.chatCompletion({
 *   messages: [
 *     { role: 'developer', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' },
 *   ],
 * });
 */
export class OpenAIAdapter extends BaseIntegrationAdapter<OpenAIMeta> {
  readonly type = IntegrationType.OPENAI;

  private openaiClient: OpenAI | null = null;

  static async forWorkspace(workspaceId: string): Promise<OpenAIAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<OpenAIMeta>(
      workspaceId,
      IntegrationType.OPENAI
    );

    if (!data) {
      return null;
    }

    if (data.secrets.length < 1) {
      console.warn('OpenAI integration requires an API Key:', { workspaceId });
      return null;
    }

    return new OpenAIAdapter(workspaceId, data.secrets, data.meta);
  }

  private getApiKey(): string {
    return this.getSecret(OPENAI_API_KEY_SECRET) || this.getPrimarySecret();
  }

  private getClient(): OpenAI {
    if (!this.openaiClient) {
      this.openaiClient = new OpenAI({
        apiKey: this.getApiKey(),
        organization: this.meta?.organizationId || undefined,
      });
    }
    return this.openaiClient;
  }

  /** Resolve a parameter with override > meta > fallback precedence */
  private resolveModel(override?: string): string {
    return override || this.meta?.model || 'gpt-4.1-mini';
  }

  private resolveTemperature(override?: number): number | undefined {
    return override ?? this.meta?.temperature ?? undefined;
  }

  private resolveMaxTokens(override?: number): number | undefined {
    return override ?? this.meta?.maxTokens ?? undefined;
  }

  // ===========================================================================
  // CHAT COMPLETIONS
  // ===========================================================================

  async chatCompletion(
    params: ChatCompletionParams
  ): Promise<IntegrationResult<ChatCompletionResult>> {
    try {
      const client = this.getClient();
      const model = this.resolveModel(params.model);

      const requestParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model,
        messages: params.messages.map((msg) => {
          if (msg.role === 'tool') {
            return {
              role: 'tool' as const,
              content: msg.content,
              tool_call_id: msg.tool_call_id!,
            };
          }
          return { role: msg.role, content: msg.content };
        }),
      };

      const temperature = this.resolveTemperature(params.temperature);
      if (temperature !== undefined) {
        requestParams.temperature = temperature;
      }

      const maxTokens = this.resolveMaxTokens(params.maxTokens);
      if (maxTokens !== undefined) {
        requestParams.max_completion_tokens = maxTokens;
      }

      if (params.tools && params.tools.length > 0) {
        requestParams.tools = params.tools;
        requestParams.tool_choice = params.toolChoice ?? 'auto';
      }

      const response = await client.chat.completions.create(requestParams);

      const choice = response.choices[0];
      if (!choice) {
        return this.error('No completion choice returned from OpenAI');
      }

      await this.touch();

      return this.success({
        content: choice.message.content,
        toolCalls: (choice.message.tool_calls || [])
          .filter((tc): tc is Extract<typeof tc, { type: 'function' }> => tc.type === 'function')
          .map((tc) => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        finishReason: choice.finish_reason || 'stop',
        usage: {
          promptTokens: response.usage?.prompt_tokens ?? 0,
          completionTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
        model: response.model,
      });
    } catch (error) {
      console.error('OpenAI chatCompletion error:', {
        workspaceId: this.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      const isRateLimit = error instanceof OpenAI.RateLimitError;
      const isServer = error instanceof OpenAI.InternalServerError;
      const retryable = isRateLimit || isServer;

      let retryAfterMs: number | undefined;
      if (retryable && error instanceof OpenAI.APIError && error.headers) {
        const retryAfter = error.headers.get('retry-after');
        if (retryAfter) {
          const seconds = Number(retryAfter);
          if (!Number.isNaN(seconds)) retryAfterMs = seconds * 1000;
        }
      }

      if (!retryable) {
        await this.markUnhealthy();
      }

      return this.error(
        error instanceof Error ? error.message : 'OpenAI API error',
        retryable,
        retryAfterMs
      );
    }
  }

  // ===========================================================================
  // MODEL LISTING
  // ===========================================================================

  async listModels(): Promise<IntegrationResult<OpenAIModel[]>> {
    try {
      const client = this.getClient();
      const page = await client.models.list();
      const models: OpenAIModel[] = [];

      for (const model of page.data) {
        models.push({
          id: model.id,
          created: model.created,
          ownedBy: model.owned_by,
        });
      }

      // Sort by created descending (newest first)
      models.sort((a, b) => b.created - a.created);

      await this.touch();
      return this.success(models);
    } catch (error) {
      console.error('OpenAI listModels error:', {
        workspaceId: this.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      await this.markUnhealthy();
      return this.error(
        error instanceof Error ? error.message : 'Failed to list models',
        false
      );
    }
  }

  // ===========================================================================
  // CONFIGURATION VALIDATION
  // ===========================================================================

  isConfigured(): boolean {
    return !!this.meta?.model;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.meta?.model) {
      errors.push('Model must be configured (e.g., "gpt-4.1-mini")');
    }

    if (this.meta?.temperature !== undefined) {
      if (this.meta.temperature < 0 || this.meta.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    if (this.meta?.maxTokens !== undefined) {
      if (this.meta.maxTokens < 1) {
        errors.push('Max tokens must be at least 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
