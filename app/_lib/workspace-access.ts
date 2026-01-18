/**
 * Workspace Access Authorization
 * 
 * This module provides functions to check and enforce user access to workspaces.
 * The key principle is that business data (leads, events, integrations) remains
 * workspace-scoped. This layer controls WHO can access workspaces, not what the
 * data belongs to.
 */

import { prisma } from './db';
import { WorkspaceRole, Workspace } from '@prisma/client';

// Re-export the enum for convenience
export { WorkspaceRole };

/**
 * Workspace access information for a user
 */
export interface WorkspaceAccess {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

/**
 * Role hierarchy - higher number = more permissions
 */
const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  OWNER: 4,  // Full control, can delete workspace, manage other owners
  ADMIN: 3,  // Can manage integrations, workflows, view all data
  MEMBER: 2, // Can view and edit most things, no secret management
  VIEWER: 1, // Read-only access
};

/**
 * Check if a user role meets the minimum required role
 */
export function hasMinimumRole(
  userRole: WorkspaceRole,
  requiredRole: WorkspaceRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Get a user's access to a specific workspace
 * Returns null if user has no access
 */
export async function getWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<WorkspaceAccess | null> {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    select: {
      role: true,
    },
  });

  if (!membership) {
    return null;
  }

  return {
    userId,
    workspaceId,
    role: membership.role,
  };
}

/**
 * Error codes for workspace access failures
 */
export const WorkspaceAccessError = {
  ACCESS_DENIED: 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
} as const;

export type WorkspaceAccessErrorCode = typeof WorkspaceAccessError[keyof typeof WorkspaceAccessError];

/**
 * Require user access to a workspace with minimum role
 * Throws an error if access is denied or insufficient
 */
export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string,
  minRole: WorkspaceRole = WorkspaceRole.VIEWER
): Promise<WorkspaceAccess> {
  const access = await getWorkspaceAccess(userId, workspaceId);
  
  if (!access) {
    throw new Error(WorkspaceAccessError.ACCESS_DENIED);
  }
  
  if (!hasMinimumRole(access.role, minRole)) {
    throw new Error(WorkspaceAccessError.INSUFFICIENT_PERMISSIONS);
  }
  
  return access;
}

/**
 * Workspace with user's role attached
 */
export interface WorkspaceWithAccess extends Workspace {
  userRole: WorkspaceRole;
}

/**
 * Get all workspaces a user has access to
 * Returns workspaces with the user's role attached
 */
export async function getUserWorkspaces(
  userId: string
): Promise<WorkspaceWithAccess[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
    orderBy: {
      workspace: {
        name: 'asc',
      },
    },
  });

  return memberships.map((membership) => ({
    ...membership.workspace,
    userRole: membership.role,
  }));
}

/**
 * Get all workspace IDs a user has access to
 * Useful for filtering queries
 */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
}

/**
 * Check if user can perform an action based on role
 * Returns true if allowed, false otherwise
 */
export async function canUserPerformAction(
  userId: string,
  workspaceId: string,
  requiredRole: WorkspaceRole
): Promise<boolean> {
  try {
    await requireWorkspaceAccess(userId, workspaceId, requiredRole);
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a user to a workspace with a specific role
 */
export async function addUserToWorkspace(
  userId: string,
  workspaceId: string,
  role: WorkspaceRole = WorkspaceRole.MEMBER
): Promise<void> {
  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    create: {
      userId,
      workspaceId,
      role,
    },
    update: {
      role,
    },
  });
}

/**
 * Remove a user from a workspace
 */
export async function removeUserFromWorkspace(
  userId: string,
  workspaceId: string
): Promise<void> {
  await prisma.workspaceMember.delete({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  }).catch(() => {
    // Ignore if membership doesn't exist
  });
}

/**
 * Update a user's role in a workspace
 */
export async function updateUserWorkspaceRole(
  userId: string,
  workspaceId: string,
  role: WorkspaceRole
): Promise<void> {
  await prisma.workspaceMember.update({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    data: { role },
  });
}

/**
 * Get all members of a workspace
 */
export async function getWorkspaceMembers(workspaceId: string) {
  return prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * Count members in a workspace
 */
export async function getWorkspaceMemberCount(workspaceId: string): Promise<number> {
  return prisma.workspaceMember.count({
    where: { workspaceId },
  });
}
