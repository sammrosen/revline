/**
 * Agent Prompt Generator
 *
 * Takes a template ID, user-provided variables, and optional reference content,
 * then produces a complete system prompt. If the workspace has an AI integration
 * and reference content is provided, AI fills the ai_generated variable slots.
 * Otherwise, placeholders are inserted for manual editing.
 */

import { prisma } from '@/app/_lib/db';
import { resolveAI } from './adapter-registry';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { getTemplate } from './prompt-templates';
import type { PromptTemplate, PromptTemplateVariable } from './prompt-templates';

// =============================================================================
// TYPES
// =============================================================================

export interface GeneratePromptParams {
  templateId: string;
  variables: Record<string, string>;
  referenceContent?: string;
  workspaceId: string;
}

export interface GeneratePromptResult {
  success: boolean;
  prompt?: string;
  initialMessage?: string;
  suggestedTools?: string[];
  error?: string;
}

// =============================================================================
// SUGGESTED TOOLS BY CATEGORY
// =============================================================================

const SUGGESTED_TOOLS: Record<string, string[]> = {
  receptionist: [],
  appointment_booker: ['check_availability', 'book_appointment', 'lookup_customer'],
  support: [],
};

// =============================================================================
// SUGGESTED INITIAL MESSAGES BY CATEGORY
// =============================================================================

function buildInitialMessage(
  category: string,
  variables: Record<string, string>,
): string {
  const name = variables.agentName || 'your assistant';
  const business = variables.businessName || 'our company';

  switch (category) {
    case 'receptionist':
      return `Hi! I'm ${name} from ${business}. How can I help you today?`;
    case 'appointment_booker':
      return `Hi! I'm ${name} at ${business}. Would you like to book an appointment?`;
    case 'support':
      return `Hi! I'm ${name} from ${business}. What can I help you with?`;
    default:
      return `Hi! I'm ${name}. How can I help you?`;
  }
}

// =============================================================================
// AI VARIABLE GENERATION
// =============================================================================

/**
 * Build a meta-prompt asking the AI to produce JSON for ai_generated variables.
 */
function buildMetaPrompt(
  aiVars: PromptTemplateVariable[],
  referenceContent: string,
): string {
  const varDescriptions = aiVars
    .map((v) => `  "${v.key}": "${v.description}"`)
    .join(',\n');

  return `You are a prompt-writing assistant. Given the following business information, generate a JSON object with these keys. Each value should be a string suitable for inserting into a system prompt.

Keys and what they should contain:
{
${varDescriptions}
}

Business information:
${referenceContent}

Respond with ONLY the JSON object, no markdown fences, no explanation.`;
}

/**
 * Try to parse JSON from an AI response. Handles markdown fences and
 * leading/trailing text gracefully.
 */
function parseAIJson(raw: string): Record<string, string> | null {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      // Coerce all values to strings
      const result: Record<string, string> = {};
      // Safe: validated above as non-null, non-array object
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        result[key] = String(value);
      }
      return result;
    }
  } catch {
    // Fall through to null
  }
  return null;
}

/**
 * Attempt to generate ai_generated variables via the workspace's AI integration.
 * Returns null if AI is unavailable or fails — caller falls back to placeholders.
 */
async function generateAIVariables(
  aiVars: PromptTemplateVariable[],
  referenceContent: string,
  workspaceId: string,
): Promise<Record<string, string> | null> {
  if (aiVars.length === 0) return {};

  // Find the workspace's AI integration
  const aiIntegration = await prisma.workspaceIntegration.findFirst({
    where: {
      workspaceId,
      integration: { in: ['OPENAI', 'ANTHROPIC'] },
    },
    select: { integration: true },
  });

  if (!aiIntegration) return null;

  const entry = resolveAI(aiIntegration.integration);
  if (!entry) return null;

  const adapter = await entry.forWorkspace(workspaceId);
  if (!adapter) return null;

  const metaPrompt = buildMetaPrompt(aiVars, referenceContent);

  try {
    const aiPromise = adapter.chatCompletion({
      messages: [{ role: 'user', content: metaPrompt }],
      temperature: 0.4,
      maxTokens: 2000,
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI generation timed out after 30s')), 30_000)
    );
    const result = await Promise.race([aiPromise, timeout]);

    if (!result.success || !result.data?.content) return null;

    return parseAIJson(result.data.content);
  } catch (error) {
    // Emit event so silent AI failures are visible in the event ledger
    emitEvent({
      workspaceId,
      system: EventSystem.AGENT,
      eventType: 'agent_prompt_generation_failed',
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown AI error',
      metadata: { aiProvider: aiIntegration.integration },
    }).catch(() => {}); // Fire-and-forget — never break main flow
    return null;
  }
}

// =============================================================================
// MAIN GENERATOR
// =============================================================================

/**
 * Fill a template's skeleton with provided and AI-generated variables.
 */
function fillSkeleton(
  template: PromptTemplate,
  mergedVars: Record<string, string>,
): string {
  let result = template.skeleton;

  for (const variable of template.variables) {
    const value = mergedVars[variable.key];
    const placeholder = `{${variable.key}}`;
    // Replace all occurrences (some vars like businessName appear multiple times)
    result = result.replaceAll(placeholder, value);
  }

  return result;
}

/**
 * Generate a complete system prompt from a template.
 *
 * 1. Load template
 * 2. Validate required user_input vars
 * 3. AI-generate ai_generated vars (if referenceContent + AI integration available)
 * 4. Fall back to [FILL: ...] placeholders for missing ai_generated vars
 * 5. Replace all {variable} placeholders in skeleton
 * 6. Return prompt + suggested tools + initial message
 */
export async function generatePrompt(
  params: GeneratePromptParams,
): Promise<GeneratePromptResult> {
  const { templateId, variables, referenceContent, workspaceId } = params;

  // 1. Load template
  const template = getTemplate(templateId);
  if (!template) {
    return { success: false, error: `Template "${templateId}" not found` };
  }

  // 2. Validate required user_input vars
  const missingRequired: string[] = [];
  for (const v of template.variables) {
    if (v.required && v.source === 'user_input' && !variables[v.key]?.trim()) {
      missingRequired.push(v.key);
    }
  }
  if (missingRequired.length > 0) {
    return {
      success: false,
      error: `Missing required variables: ${missingRequired.join(', ')}`,
    };
  }

  // 3. Attempt AI generation for ai_generated vars
  const aiVars = template.variables.filter((v) => v.source === 'ai_generated');
  let aiGenerated: Record<string, string> | null = null;

  if (referenceContent?.trim() && aiVars.length > 0) {
    aiGenerated = await generateAIVariables(aiVars, referenceContent, workspaceId);
  }

  // 4. Merge: user input takes priority, then AI, then placeholder
  const mergedVars: Record<string, string> = {};
  for (const v of template.variables) {
    if (variables[v.key]?.trim()) {
      // User explicitly provided a value — always use it
      mergedVars[v.key] = variables[v.key];
    } else if (aiGenerated && aiGenerated[v.key]?.trim()) {
      // AI generated a value
      mergedVars[v.key] = aiGenerated[v.key];
    } else if (v.source === 'ai_generated') {
      // No AI result — insert a fill-in placeholder
      mergedVars[v.key] = `[FILL: ${v.description}]`;
    } else {
      // Optional user_input with no value — use placeholder text
      mergedVars[v.key] = v.placeholder;
    }
  }

  // 5. Fill skeleton
  const prompt = fillSkeleton(template, mergedVars);

  // 6. Build result
  return {
    success: true,
    prompt,
    initialMessage: buildInitialMessage(template.category, mergedVars),
    suggestedTools: SUGGESTED_TOOLS[template.category] ?? [],
  };
}
