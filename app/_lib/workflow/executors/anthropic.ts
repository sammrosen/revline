/**
 * Anthropic Action Executors
 *
 * Executors for Anthropic Claude text generation operations.
 * Uses the AnthropicAdapter for API calls.
 *
 * Supports {{lead.*}}, {{payload.*}}, {{action.*}} template variable resolution
 * in the prompt and system prompt.
 */

import { AnthropicAdapter } from '@/app/_lib/integrations';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { prisma } from '@/app/_lib/db';
import { WorkflowContext, ActionResult, ActionExecutor } from '../types';

// =============================================================================
// TEMPLATE VARIABLE RESOLUTION
// =============================================================================

const TEMPLATE_VAR_REGEX = /\{\{(lead|payload|action)\.([a-zA-Z0-9_.]+)\}\}/g;

function resolveTemplateVars(
  template: string,
  context: {
    lead?: {
      email: string;
      source: string | null;
      stage: string;
      properties: Record<string, unknown> | null;
    };
    payload: Record<string, unknown>;
    actionData: Record<string, unknown>;
  }
): string {
  return template.replace(TEMPLATE_VAR_REGEX, (_match, namespace: string, key: string) => {
    let value: unknown;

    switch (namespace) {
      case 'lead': {
        if (!context.lead) return '';
        const builtInFields: Record<string, unknown> = {
          email: context.lead.email,
          source: context.lead.source,
          stage: context.lead.stage,
        };
        value = builtInFields[key] ?? context.lead.properties?.[key];
        break;
      }
      case 'payload':
        value = context.payload[key];
        break;
      case 'action':
        value = context.actionData[key];
        break;
      default:
        value = undefined;
    }

    if (value === null || value === undefined) return '';
    return String(value);
  });
}

// =============================================================================
// EXECUTORS
// =============================================================================

/**
 * Generate text using Anthropic Claude Messages API
 *
 * Params:
 * - prompt: User message text. Supports {{lead.*}}, {{payload.*}}, {{action.*}} template vars.
 * - systemPrompt: Optional system instructions for Claude.
 * - model: Optional model override (uses integration config default otherwise).
 * - temperature: Optional temperature override (0-1).
 * - maxTokens: Optional max tokens override.
 */
const generateText: ActionExecutor = {
  async execute(
    ctx: WorkflowContext,
    params: Record<string, unknown>
  ): Promise<ActionResult> {
    let prompt = params.prompt as string | undefined;
    let systemPrompt = params.systemPrompt as string | undefined;
    const modelOverride = params.model as string | undefined;
    const temperatureOverride = params.temperature as number | undefined;
    const maxTokensOverride = params.maxTokens as number | undefined;

    if (!prompt) {
      return { success: false, error: 'Missing prompt parameter' };
    }

    const adapter = await AnthropicAdapter.forWorkspace(ctx.workspaceId);
    if (!adapter) {
      return { success: false, error: 'Anthropic not configured for this workspace' };
    }

    const validation = adapter.validateConfig();
    if (!validation.valid) {
      return {
        success: false,
        error: `Anthropic configuration error: ${validation.errors.join(', ')}`,
      };
    }

    // Resolve template variables
    const hasTemplateVars = TEMPLATE_VAR_REGEX.test(prompt) || (systemPrompt && TEMPLATE_VAR_REGEX.test(systemPrompt));
    TEMPLATE_VAR_REGEX.lastIndex = 0;

    let leadData: { email: string; source: string | null; stage: string; properties: Record<string, unknown> | null } | undefined;

    if (hasTemplateVars && ctx.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: ctx.leadId },
        select: { email: true, source: true, stage: true, properties: true },
      });
      if (lead) {
        leadData = {
          email: lead.email,
          source: lead.source,
          stage: lead.stage,
          properties: (lead.properties as Record<string, unknown>) ?? null,
        };
      }
    }

    if (hasTemplateVars) {
      const templateCtx = {
        lead: leadData,
        payload: ctx.trigger.payload,
        actionData: ctx.actionData,
      };
      prompt = resolveTemplateVars(prompt, templateCtx);
      if (systemPrompt) {
        TEMPLATE_VAR_REGEX.lastIndex = 0;
        systemPrompt = resolveTemplateVars(systemPrompt, templateCtx);
      }
    }

    // Build messages -- the adapter handles extracting system prompt into Anthropic's top-level `system` param
    const messages: Array<{ role: 'developer' | 'user'; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'developer', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const result = await adapter.chatCompletion({
      messages,
      model: modelOverride,
      temperature: temperatureOverride,
      maxTokens: maxTokensOverride,
    });

    await emitEvent({
      workspaceId: ctx.workspaceId,
      leadId: ctx.leadId,
      system: EventSystem.ANTHROPIC,
      eventType: result.success ? 'anthropic_text_generated' : 'anthropic_generation_failed',
      success: result.success,
      errorMessage: result.error,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        content: result.data?.content,
        finishReason: result.data?.finishReason,
        model: result.data?.model,
        usage: result.data?.usage,
      },
    };
  },
};

// =============================================================================
// EXPORT
// =============================================================================

export const anthropicExecutors: Record<string, ActionExecutor> = {
  generate_text: generateText,
};
