/**
 * Workspace Clone Service
 *
 * Clones a workspace — config, agents, workflows, webchat/phone configs,
 * and integration metadata (NOT secrets). Runs in a single transaction
 * so failures roll back cleanly.
 *
 * Use case: Sam has a "golden" workspace fully configured. New client =
 * clone → swap API keys → tweak copy → live.
 */

import { prisma } from '@/app/_lib/db';
import { Prisma, WorkspaceRole } from '@prisma/client';

/** Convert nullable JsonValue from DB reads to InputJsonValue for creates */
function jsonOrUndefined(val: unknown): Prisma.InputJsonValue | undefined {
  if (val === null || val === undefined) return undefined;
  return val as Prisma.InputJsonValue;
}

// =============================================================================
// TYPES
// =============================================================================

export interface CloneWorkspaceParams {
  sourceWorkspaceId: string;
  name: string;
  slug: string;
  timezone?: string;
  userId: string;
  organizationId?: string;
}

export interface CloneWorkspaceResult {
  workspaceId: string;
  name: string;
  slug: string;
  cloned: {
    integrations: number;
    agents: number;
    agentFiles: number;
    workflows: number;
    webchatConfigs: number;
    phoneConfigs: number;
  };
}

// =============================================================================
// CLONE
// =============================================================================

export async function cloneWorkspace(
  params: CloneWorkspaceParams
): Promise<CloneWorkspaceResult> {
  const { sourceWorkspaceId, name, slug, timezone, userId, organizationId } = params;

  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Load source workspace with all cloneable relations
    const source = await tx.workspace.findUnique({
      where: { id: sourceWorkspaceId },
      include: {
        integrations: true,
        agents: { include: { files: true } },
        workflows: true,
        webchatConfigs: true,
        phoneConfigs: true,
      },
    });

    if (!source) {
      throw new Error('Source workspace not found');
    }

    // 2. Create new workspace with cloned config
    const newWorkspace = await tx.workspace.create({
      data: {
        name,
        slug: slug.toLowerCase(),
        timezone: timezone ?? source.timezone,
        organizationId: organizationId ?? source.organizationId,
        createdById: userId,
        leadStages: source.leadStages as Prisma.InputJsonValue,
        leadPropertySchema: jsonOrUndefined(source.leadPropertySchema),
        pagesConfig: jsonOrUndefined(source.pagesConfig),
      },
    });

    // 3. Create OWNER membership
    await tx.workspaceMember.create({
      data: {
        userId,
        workspaceId: newWorkspace.id,
        role: WorkspaceRole.OWNER,
      },
    });

    // 4. Clone integrations (meta only, NOT secrets)
    const clonedIntegrations = await Promise.all(
      source.integrations.map((i) =>
        tx.workspaceIntegration.create({
          data: {
            workspaceId: newWorkspace.id,
            integration: i.integration,
            meta: jsonOrUndefined(i.meta),
            // secrets intentionally omitted — must be re-entered
          },
        })
      )
    );

    // 5. Clone agents + files, track old→new ID mapping
    const agentIdMap = new Map<string, string>();
    let totalFiles = 0;

    for (const agent of source.agents) {
      const newAgent = await tx.agent.create({
        data: {
          workspaceId: newWorkspace.id,
          name: agent.name,
          description: agent.description,
          channels: agent.channels as Prisma.InputJsonValue,
          aiIntegration: agent.aiIntegration,
          systemPrompt: agent.systemPrompt,
          initialMessage: agent.initialMessage,
          modelOverride: agent.modelOverride,
          temperatureOverride: agent.temperatureOverride,
          maxTokensOverride: agent.maxTokensOverride,
          maxMessagesPerConversation: agent.maxMessagesPerConversation,
          maxTokensPerConversation: agent.maxTokensPerConversation,
          conversationTimeoutMinutes: agent.conversationTimeoutMinutes,
          responseDelaySeconds: agent.responseDelaySeconds,
          autoResumeMinutes: agent.autoResumeMinutes,
          rateLimitPerHour: agent.rateLimitPerHour,
          fallbackMessage: agent.fallbackMessage,
          escalationPattern: agent.escalationPattern,
          faqOverrides: jsonOrUndefined(agent.faqOverrides),
          allowUnicode: agent.allowUnicode,
          followUpEnabled: agent.followUpEnabled,
          followUpAiGenerated: agent.followUpAiGenerated,
          followUpSequence: agent.followUpSequence as Prisma.InputJsonValue,
          allowedEvents: agent.allowedEvents as Prisma.InputJsonValue,
          enabledTools: agent.enabledTools as Prisma.InputJsonValue,
          guardrails: agent.guardrails as Prisma.InputJsonValue,
          active: agent.active,
        },
      });

      agentIdMap.set(agent.id, newAgent.id);

      // Clone agent files (reference docs for RAG)
      for (const file of agent.files) {
        await tx.agentFile.create({
          data: {
            agentId: newAgent.id,
            filename: file.filename,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            textContent: file.textContent,
          },
        });
        totalFiles++;
      }
    }

    // 6. Clone workflows (remap agentId references in actions JSON)
    const clonedWorkflows = await Promise.all(
      source.workflows.map((w) =>
        tx.workflow.create({
          data: {
            workspaceId: newWorkspace.id,
            name: w.name,
            description: w.description,
            enabled: w.enabled,
            triggerAdapter: w.triggerAdapter,
            triggerOperation: w.triggerOperation,
            triggerFilter: jsonOrUndefined(w.triggerFilter),
            actions: remapAgentIds(w.actions, agentIdMap),
          },
        })
      )
    );

    // 7. Clone webchat configs (remap agentId)
    const clonedWebchats = await Promise.all(
      source.webchatConfigs.map((wc) => {
        const newAgentId = agentIdMap.get(wc.agentId);
        if (!newAgentId) return null; // skip if agent wasn't cloned
        return tx.webchatConfig.create({
          data: {
            workspaceId: newWorkspace.id,
            agentId: newAgentId,
            name: wc.name,
            brandColor: wc.brandColor,
            chatName: wc.chatName,
            collectEmail: wc.collectEmail,
            collectPhone: wc.collectPhone,
            greeting: wc.greeting,
            active: wc.active,
          },
        });
      })
    );

    // 8. Clone phone configs (remap agentId)
    const clonedPhones = await Promise.all(
      source.phoneConfigs.map((pc) => {
        const newAgentId = pc.agentId ? agentIdMap.get(pc.agentId) : null;
        return tx.phoneConfig.create({
          data: {
            workspaceId: newWorkspace.id,
            name: pc.name,
            twilioNumberKey: pc.twilioNumberKey,
            forwardingNumber: pc.forwardingNumber,
            mode: pc.mode,
            agentId: newAgentId ?? null,
            autoTextTemplate: pc.autoTextTemplate,
            voiceGreeting: pc.voiceGreeting,
            notificationTemplate: pc.notificationTemplate,
            blocklist: pc.blocklist as Prisma.InputJsonValue,
            enabled: pc.enabled,
          },
        });
      })
    );

    // 9. Remap pagesConfig.webchat.agentId if present
    if (newWorkspace.pagesConfig && typeof newWorkspace.pagesConfig === 'object') {
      const config = newWorkspace.pagesConfig as Record<string, unknown>;
      const webchat = config.webchat as Record<string, unknown> | undefined;
      if (webchat?.agentId && typeof webchat.agentId === 'string') {
        const remapped = agentIdMap.get(webchat.agentId);
        if (remapped) {
          await tx.workspace.update({
            where: { id: newWorkspace.id },
            data: {
              pagesConfig: {
                ...config,
                webchat: { ...webchat, agentId: remapped },
              },
            },
          });
        }
      }
    }

    return {
      workspaceId: newWorkspace.id,
      name: newWorkspace.name,
      slug: newWorkspace.slug,
      cloned: {
        integrations: clonedIntegrations.length,
        agents: agentIdMap.size,
        agentFiles: totalFiles,
        workflows: clonedWorkflows.length,
        webchatConfigs: clonedWebchats.filter(Boolean).length,
        phoneConfigs: clonedPhones.length,
      },
    };
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Remap agentId references inside workflow actions JSON.
 * Workflow actions that use `route_to_agent` have params.agentId.
 */
function remapAgentIds(
  actions: unknown,
  agentIdMap: Map<string, string>
): Prisma.InputJsonValue {
  if (!Array.isArray(actions)) return actions as Prisma.InputJsonValue;

  return actions.map((action: Record<string, unknown>) => {
    if (
      action.adapter === 'agent' &&
      action.operation === 'route_to_agent' &&
      action.params &&
      typeof action.params === 'object'
    ) {
      const params = action.params as Record<string, unknown>;
      if (typeof params.agentId === 'string') {
        const remapped = agentIdMap.get(params.agentId);
        if (remapped) {
          return {
            ...action,
            params: { ...params, agentId: remapped },
          };
        }
      }
    }
    return action;
  }) as Prisma.InputJsonValue;
}
