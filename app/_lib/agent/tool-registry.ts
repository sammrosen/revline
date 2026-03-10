/**
 * Agent Tool Registry
 *
 * Extensible registry for agent tools (function calling). Third registry
 * alongside AI and Channel registries. Adding a new tool = one entry here.
 * Zero engine changes.
 *
 * The engine resolves tools by key from the agent's enabledTools list,
 * converts them to AI-format ToolDefinitions, and dispatches execution
 * through the registry. Tools never touch the engine; the engine never
 * imports tool implementations.
 *
 * STANDARDS:
 * - Agnostic: engine resolves tools by key, never branches on tool names
 * - Extensible: new tools register here, not in engine.ts
 * - Workspace-scoped: every execution receives workspaceId for provider resolution
 * - Fail-safe: tool failures return structured errors, never throw
 */

import type { ToolDefinition } from '@/app/_lib/integrations';

// =============================================================================
// TYPES
// =============================================================================

export interface ToolExecutionContext {
  workspaceId: string;
  agentId: string;
  conversationId: string;
  leadId?: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentToolDefinition {
  /** Unique tool name (used as registry key and AI function name) */
  name: string;
  /** Human-readable description for AI and UI */
  description: string;
  /** JSON Schema for parameters */
  parameters: Record<string, unknown>;
  /** Execute the tool with parsed arguments */
  execute(ctx: ToolExecutionContext): Promise<ToolResult>;
  /** Category for UI grouping */
  category: string;
  /** Human-readable label for UI */
  label: string;
}

export interface ResolvedTools {
  /** ToolDefinition[] in AI-adapter format (OpenAI/Anthropic compatible) */
  definitions: ToolDefinition[];
  /** Map from tool name to executor for the engine loop */
  executors: Map<string, AgentToolDefinition>;
}

// =============================================================================
// REGISTRY
// =============================================================================

const TOOL_REGISTRY: Record<string, AgentToolDefinition> = {};

/**
 * Register a tool in the global registry.
 * Called at module load time by tool implementation files.
 */
export function registerTool(tool: AgentToolDefinition): void {
  TOOL_REGISTRY[tool.name] = tool;
}

/**
 * Resolve an agent's enabled tools into AI-format definitions and executors.
 * Returns only the tools that are both registered and enabled for this agent.
 */
export function resolveTools(enabledTools: string[]): ResolvedTools {
  const definitions: ToolDefinition[] = [];
  const executors = new Map<string, AgentToolDefinition>();

  for (const name of enabledTools) {
    const tool = TOOL_REGISTRY[name];
    if (!tool) continue;

    definitions.push(toToolDefinition(tool));
    executors.set(name, tool);
  }

  return { definitions, executors };
}

/**
 * Get all registered tool names and metadata for UI display.
 */
export function getAvailableTools(): Array<{
  name: string;
  label: string;
  description: string;
  category: string;
}> {
  return Object.values(TOOL_REGISTRY).map((tool) => ({
    name: tool.name,
    label: tool.label,
    description: tool.description,
    category: tool.category,
  }));
}

/**
 * Check if a tool name is registered.
 */
export function isRegisteredTool(name: string): boolean {
  return name in TOOL_REGISTRY;
}

/**
 * Convert internal AgentToolDefinition to AI-adapter ToolDefinition format.
 */
function toToolDefinition(tool: AgentToolDefinition): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

/**
 * Execute a tool by name. Returns a structured ToolResult, never throws.
 */
export async function executeTool(
  name: string,
  ctx: ToolExecutionContext
): Promise<ToolResult> {
  const tool = TOOL_REGISTRY[name];
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}` };
  }

  try {
    return await tool.execute(ctx);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Tool execution failed',
    };
  }
}
