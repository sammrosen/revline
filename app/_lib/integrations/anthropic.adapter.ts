/**
 * Anthropic Integration Adapter
 * 
 * Handles Anthropic Messages API operations for a specific workspace.
 * This is a "dumb pipe" — it sends messages to the API and returns responses.
 * Conversation state management is handled by the agent engine (separate layer).
 * 
 * Key differences from OpenAI:
 * - System prompt is a top-level `system` param, not a message role
 * - `max_tokens` is required on every call
 * - Tool use returns `tool_use` content blocks, results are `tool_result` blocks
 * - Temperature range is 0-1 (not 0-2)
 * 
 * Secret names:
 * - "API Key" - Required for all API calls
 * 
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes credentials outside this module
 * - Uses official Anthropic SDK
 */

import { IntegrationType } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { BaseIntegrationAdapter } from './base';
import { AnthropicMeta, IntegrationResult } from '@/app/_lib/types';
import type {
  ChatCompletionParams,
  ChatCompletionResult,
  ToolCall,
} from './openai.adapter';

export const ANTHROPIC_API_KEY_SECRET = 'API Key';

export interface AnthropicModel {
  id: string;
  displayName: string;
  createdAt: string;
}

/**
 * Anthropic adapter for workspace-scoped AI completions
 * 
 * @example
 * const adapter = await AnthropicAdapter.forWorkspace(workspaceId);
 * if (!adapter) return ApiResponse.configError();
 * 
 * const result = await adapter.chatCompletion({
 *   messages: [
 *     { role: 'developer', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' },
 *   ],
 * });
 */
export class AnthropicAdapter extends BaseIntegrationAdapter<AnthropicMeta> {
  readonly type = IntegrationType.ANTHROPIC;

  private anthropicClient: Anthropic | null = null;

  static async forWorkspace(workspaceId: string): Promise<AnthropicAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<AnthropicMeta>(
      workspaceId,
      IntegrationType.ANTHROPIC
    );

    if (!data) {
      return null;
    }

    if (data.secrets.length < 1) {
      console.warn('Anthropic integration requires an API Key:', { workspaceId });
      return null;
    }

    return new AnthropicAdapter(workspaceId, data.secrets, data.meta);
  }

  private getApiKey(): string {
    return this.getSecret(ANTHROPIC_API_KEY_SECRET) || this.getPrimarySecret();
  }

  private getClient(): Anthropic {
    if (!this.anthropicClient) {
      this.anthropicClient = new Anthropic({
        apiKey: this.getApiKey(),
      });
    }
    return this.anthropicClient;
  }

  private resolveModel(override?: string): string {
    return override || this.meta?.model || 'claude-sonnet-4-6';
  }

  private resolveTemperature(override?: number): number | undefined {
    return override ?? this.meta?.temperature ?? undefined;
  }

  private resolveMaxTokens(override?: number): number {
    return override ?? this.meta?.maxTokens ?? 1024;
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

      // Extract system prompt from 'developer' role messages (our universal system prompt role)
      const systemMessages = params.messages.filter((m) => m.role === 'developer');
      const systemPrompt = systemMessages.map((m) => m.content).join('\n\n') || undefined;

      // Map remaining messages to Anthropic format
      const anthropicMessages: Anthropic.MessageParam[] = [];
      for (const msg of params.messages) {
        if (msg.role === 'developer') continue;

        if (msg.role === 'tool') {
          anthropicMessages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: msg.tool_call_id!,
                content: msg.content,
              },
            ],
          });
        } else {
          anthropicMessages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }

      const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: this.resolveMaxTokens(params.maxTokens),
        messages: anthropicMessages,
      };

      if (systemPrompt) {
        requestParams.system = systemPrompt;
      }

      const temperature = this.resolveTemperature(params.temperature);
      if (temperature !== undefined) {
        requestParams.temperature = temperature;
      }

      if (params.tools && params.tools.length > 0) {
        requestParams.tools = params.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
        }));
      }

      const response = await client.messages.create(requestParams);

      // Extract text content and tool use blocks
      let textContent: string | null = null;
      const toolCalls: ToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent = (textContent || '') + block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }

      // Map stop_reason to our finishReason
      const finishReasonMap: Record<string, string> = {
        end_turn: 'stop',
        max_tokens: 'length',
        tool_use: 'tool_calls',
        stop_sequence: 'stop',
      };

      await this.touch();

      return this.success({
        content: textContent,
        toolCalls,
        finishReason: (response.stop_reason && finishReasonMap[response.stop_reason]) || response.stop_reason || 'stop',
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
      });
    } catch (error) {
      console.error('Anthropic chatCompletion error:', {
        workspaceId: this.workspaceId,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      const isRateLimit = error instanceof Anthropic.RateLimitError;
      const isServer = error instanceof Anthropic.InternalServerError;
      const retryable = isRateLimit || isServer;

      if (!retryable) {
        await this.markUnhealthy();
      }

      return this.error(
        error instanceof Error ? error.message : 'Anthropic API error',
        retryable
      );
    }
  }

  // ===========================================================================
  // MODEL LISTING
  // ===========================================================================

  async listModels(): Promise<IntegrationResult<AnthropicModel[]>> {
    try {
      const client = this.getClient();
      const models: AnthropicModel[] = [];

      const page = await client.models.list({ limit: 100 });

      for (const model of page.data) {
        models.push({
          id: model.id,
          displayName: model.display_name,
          createdAt: model.created_at,
        });
      }

      await this.touch();
      return this.success(models);
    } catch (error) {
      console.error('Anthropic listModels error:', {
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
    return !!this.meta?.model && !!this.meta?.maxTokens;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.meta?.model) {
      errors.push('Model must be configured (e.g., "claude-sonnet-4-6")');
    }

    if (!this.meta?.maxTokens || this.meta.maxTokens < 1) {
      errors.push('Max tokens is required and must be at least 1');
    }

    if (this.meta?.temperature !== undefined) {
      if (this.meta.temperature < 0 || this.meta.temperature > 1) {
        errors.push('Temperature must be between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
