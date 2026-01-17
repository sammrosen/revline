import { prisma } from './db';
import { emitEvent, EventSystem } from './event-logger';
import { Workspace, WorkspaceStatus } from '@prisma/client';

export type { Workspace };
export { WorkspaceStatus };

/**
 * Get a workspace by their slug (the ?source= parameter)
 * Returns null if workspace doesn't exist
 */
export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  return prisma.workspace.findUnique({
    where: { slug: slug.toLowerCase() },
  });
}

/**
 * Check if a workspace is active
 * Returns true only if workspace exists AND status is ACTIVE
 */
export async function checkWorkspaceActive(workspaceId: string): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { status: true },
  });
  return workspace?.status === WorkspaceStatus.ACTIVE;
}

/**
 * Get an active workspace by slug, or null if not found or paused
 * This is the main entry point for route handlers
 * 
 * If workspace is paused, emits execution_blocked event and returns null
 */
export async function getActiveWorkspace(slug: string): Promise<Workspace | null> {
  const workspace = await getWorkspaceBySlug(slug);

  if (!workspace) {
    return null;
  }

  if (workspace.status !== WorkspaceStatus.ACTIVE) {
    // Workspace exists but is paused - emit blocked event
    await emitEvent({
      workspaceId: workspace.id,
      system: EventSystem.BACKEND,
      eventType: 'execution_blocked',
      success: false,
      errorMessage: `Workspace ${slug} is paused`,
    });
    return null;
  }

  return workspace;
}

/**
 * Pause a workspace - blocks all automation execution
 */
export async function pauseWorkspace(workspaceId: string): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { status: WorkspaceStatus.PAUSED },
  });

  await emitEvent({
    workspaceId,
    system: EventSystem.BACKEND,
    eventType: 'workspace_paused',
    success: true,
  });
}

/**
 * Unpause a workspace - resumes automation execution
 */
export async function unpauseWorkspace(workspaceId: string): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { status: WorkspaceStatus.ACTIVE },
  });

  await emitEvent({
    workspaceId,
    system: EventSystem.BACKEND,
    eventType: 'workspace_unpaused',
    success: true,
  });
}

// Legacy aliases for backwards compatibility during migration
export const getClientBySlug = getWorkspaceBySlug;
export const checkClientActive = checkWorkspaceActive;
export const getActiveClient = getActiveWorkspace;
export const pauseClient = pauseWorkspace;
export const unpauseClient = unpauseWorkspace;
export type Client = Workspace;
export const ClientStatus = WorkspaceStatus;
