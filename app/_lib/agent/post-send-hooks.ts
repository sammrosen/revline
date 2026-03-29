/**
 * Post-Send Hook Registry
 *
 * Generic dispatcher for fire-and-forget hooks that run after the agent
 * engine successfully sends a message. Each hook is keyed by IntegrationType
 * so adding a new CRM just means registering a function — the engine never
 * imports integration-specific code.
 *
 * STANDARDS:
 * - Abstraction First: engine calls dispatchPostSendHooks(), never a specific adapter
 * - Fail-Safe Defaults: every hook is wrapped in try/catch, never blocks delivery
 * - Workspace Isolation: dispatcher queries workspace integrations, hooks receive context
 */

import { IntegrationType } from '@prisma/client';
import { prisma } from '@/app/_lib/db';
import { logStructured } from '@/app/_lib/reliability';
import type { AgentConfig } from './types';
import { logPipedriveActivity } from './pipedrive-activity';

export interface PostSendContext {
  workspaceId: string;
  agent: AgentConfig;
  contactAddress: string;
  body: string;
  channelType: string | undefined;
}

type PostSendHook = (ctx: PostSendContext) => Promise<void>;

const POST_SEND_HOOKS: Partial<Record<IntegrationType, PostSendHook>> = {
  PIPEDRIVE: logPipedriveActivity,
};

/**
 * Dispatch all registered post-send hooks for the workspace's active integrations.
 * Each hook runs independently — one failure doesn't affect others.
 * The caller should invoke this with `.catch(() => {})` to ensure it never blocks.
 */
export async function dispatchPostSendHooks(ctx: PostSendContext): Promise<void> {
  try {
    const integrations = await prisma.workspaceIntegration.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { integration: true },
    });

    const hooks = integrations
      .map((i) => POST_SEND_HOOKS[i.integration])
      .filter((h): h is PostSendHook => h != null);

    if (hooks.length === 0) return;

    await Promise.allSettled(hooks.map((hook) => hook(ctx)));
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'post_send_hooks_dispatch_error',
      workspaceId: ctx.workspaceId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
  }
}
