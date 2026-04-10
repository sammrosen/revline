/**
 * Workflow Executor → Agent Tool Bridge
 *
 * Wraps workflow action executors as agent tools so AI agents can call
 * integration operations (Pipedrive, MailerLite, Resend, Twilio, etc.)
 * mid-conversation via function calling.
 *
 * The bridge reads the executor registry + adapter registry, converts
 * Zod paramsSchemas to JSON Schema, and registers each action as an
 * AgentToolDefinition. Adding a new workflow action automatically makes
 * it available as an agent tool — zero engine changes.
 *
 * EXCLUDED adapters:
 * - actionflow: out of scope for current agent use cases
 * - openai, anthropic: generate_text would be recursive (agent calling AI)
 * - agent: route_to_agent would be recursive
 * - manychat: no executor implemented yet
 */

import { registerTool } from '../tool-registry';
import type { ToolExecutionContext, ToolResult } from '../tool-registry';
import { ADAPTER_REGISTRY } from '@/app/_lib/workflow/registry';
import type { WorkflowContext } from '@/app/_lib/workflow/types';
import { prisma } from '@/app/_lib/db';

// Lazy import to avoid circular dependency — executors import adapters
// which may import agent modules
let _getActionExecutor: typeof import('@/app/_lib/workflow/executors/index').getActionExecutor | null = null;

async function getExecutor(adapter: string, operation: string) {
  if (!_getActionExecutor) {
    const mod = await import('@/app/_lib/workflow/executors/index');
    _getActionExecutor = mod.getActionExecutor;
  }
  return _getActionExecutor(adapter, operation);
}

// =============================================================================
// ADAPTERS TO BRIDGE
// =============================================================================

const BRIDGED_ADAPTERS = [
  'pipedrive',
  'revline',
  'mailerlite',
  'resend',
  'twilio',
  'abc_ignite',
];

// =============================================================================
// ZOD → JSON SCHEMA (minimal converter for flat object schemas)
// =============================================================================

function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  // Zod schemas expose their shape via _def
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)?._def;
  if (!def) return { type: 'object', properties: {} };

  // Handle ZodObject
  if (def.typeName === 'ZodObject' && def.shape) {
    const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    for (const [key, fieldSchema] of Object.entries(shape)) {
      properties[key] = zodFieldToJsonSchema(fieldSchema);
      if (!isOptional(fieldSchema)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  return { type: 'object', properties: {} };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodFieldToJsonSchema(field: any): Record<string, unknown> {
  const def = field?._def;
  if (!def) return { type: 'string' };

  const result: Record<string, unknown> = {};

  // Unwrap optional/default/nullable wrappers
  if (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable') {
    return zodFieldToJsonSchema(def.innerType);
  }
  if (def.typeName === 'ZodDefault') {
    const inner = zodFieldToJsonSchema(def.innerType);
    inner.default = def.defaultValue();
    return inner;
  }

  // Primitive types
  switch (def.typeName) {
    case 'ZodString':
      result.type = 'string';
      break;
    case 'ZodNumber':
      result.type = 'number';
      break;
    case 'ZodBoolean':
      result.type = 'boolean';
      break;
    case 'ZodEnum':
      result.type = 'string';
      result.enum = def.values;
      break;
    case 'ZodRecord':
      result.type = 'object';
      result.additionalProperties = true;
      break;
    case 'ZodCoerce': {
      // z.coerce.number() wraps an inner type
      const inner = zodFieldToJsonSchema(def.innerType);
      return { ...inner, ...result };
    }
    default:
      result.type = 'string';
  }

  // Extract description from .describe()
  if (def.description) {
    result.description = def.description;
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isOptional(field: any): boolean {
  const def = field?._def;
  if (!def) return false;
  if (def.typeName === 'ZodOptional' || def.typeName === 'ZodNullable') return true;
  if (def.typeName === 'ZodDefault') return true;
  return false;
}

// =============================================================================
// CONTEXT TRANSLATION
// =============================================================================

async function buildWorkflowContext(
  ctx: ToolExecutionContext
): Promise<WorkflowContext> {
  let email = '';
  let name = '';

  // Resolve lead email/name for executors that need it
  if (ctx.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: ctx.leadId },
      select: { email: true, properties: true },
    });
    if (lead) {
      email = lead.email;
      const props = lead.properties as Record<string, unknown> | null;
      name = (typeof props?.name === 'string' ? props.name : '') as string;
    }
  }

  // Allow the AI to pass email/name directly as tool params (fallback)
  if (!email && typeof ctx.args.email === 'string') {
    email = ctx.args.email;
  }
  if (!name && typeof ctx.args.name === 'string') {
    name = ctx.args.name;
  }

  return {
    workspaceId: ctx.workspaceId,
    clientId: ctx.workspaceId,
    trigger: { adapter: 'agent', operation: 'tool_call', payload: {} },
    email,
    name,
    leadId: ctx.leadId,
    actionData: {},
    isTest: false,
  };
}

// =============================================================================
// REGISTRATION
// =============================================================================

for (const adapterId of BRIDGED_ADAPTERS) {
  const adapter = ADAPTER_REGISTRY[adapterId];
  if (!adapter) continue;

  for (const [operationId, opDef] of Object.entries(adapter.actions)) {
    const toolName = `${adapterId}.${operationId}`;
    const paramsJsonSchema = opDef.paramsSchema
      ? zodToJsonSchema(opDef.paramsSchema)
      : { type: 'object', properties: {} };

    registerTool({
      name: toolName,
      label: opDef.label,
      description: opDef.description ?? opDef.label,
      category: adapter.name,
      parameters: paramsJsonSchema,
      execute: async (ctx: ToolExecutionContext): Promise<ToolResult> => {
        try {
          const executor = await getExecutor(adapterId, operationId);
          const workflowCtx = await buildWorkflowContext(ctx);
          const result = await executor.execute(workflowCtx, ctx.args);
          return {
            success: result.success,
            data: result.data,
            error: result.error,
          };
        } catch (err) {
          return {
            success: false,
            error: err instanceof Error ? err.message : `Failed to execute ${toolName}`,
          };
        }
      },
    });
  }
}
