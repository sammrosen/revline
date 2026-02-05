/**
 * Workspace Access Authorization
 * 
 * This module provides functions to check and enforce user access to workspaces.
 * The key principle is that business data (leads, events, integrations) remains
 * workspace-scoped. This layer controls WHO can access workspaces, not what the
 * data belongs to.
 * 
 * Access hierarchy:
 * 1. Direct workspace membership (WorkspaceMember) - checked first
 * 2. Organization membership (OrganizationMember) - fallback if no direct access
 *    - Org owners get OWNER role
 *    - Org members with canAccessAllWorkspaces get ADMIN role
 *    - Org members with workspace assignment get MEMBER role
 */

import { prisma } from './db';
import { WorkspaceRole, Workspace } from '@prisma/client';
import { 
  getOrgAccess, 
  isUserAssignedToWorkspace,
  getEffectivePermissions,
} from './organization-access';

// Re-export the enum for convenience
export { WorkspaceRole };

/**
 * Workspace access information for a user
 */
export interface WorkspaceAccess {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  /** Whether access is via org membership (vs direct workspace membership) */
  viaOrg?: boolean;
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
 * Get direct workspace membership (without org fallback)
 * Used internally when we need to check explicit membership
 */
async function getDirectWorkspaceAccess(
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
    viaOrg: false,
  };
}

/**
 * Get a user's access to a specific workspace
 * Checks direct membership first, then falls back to org-level access
 * Returns null if user has no access via either path
 */
export async function getWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<WorkspaceAccess | null> {
  // 1. Check direct workspace membership first
  const directAccess = await getDirectWorkspaceAccess(userId, workspaceId);
  if (directAccess) {
    return directAccess;
  }

  // 2. Check org-level access
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });

  if (!workspace?.organizationId) {
    return null;
  }

  const orgAccess = await getOrgAccess(userId, workspace.organizationId);
  if (!orgAccess) {
    return null;
  }

  // 3. Determine role based on org membership
  // Owners get OWNER role
  if (orgAccess.isOwner) {
    return {
      userId,
      workspaceId,
      role: WorkspaceRole.OWNER,
      viaOrg: true,
    };
  }

  // Members with canAccessAllWorkspaces get ADMIN role
  if (orgAccess.permissions.canAccessAllWorkspaces) {
    return {
      userId,
      workspaceId,
      role: WorkspaceRole.ADMIN,
      viaOrg: true,
    };
  }

  // 4. Check if user is assigned to this specific workspace
  const isAssigned = await isUserAssignedToWorkspace(userId, workspaceId);
  if (!isAssigned) {
    return null;
  }

  // Assigned members get MEMBER role
  return {
    userId,
    workspaceId,
    role: WorkspaceRole.MEMBER,
    viaOrg: true,
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
  /** Whether access is via org membership */
  viaOrg?: boolean;
}

/**
 * Get all workspaces a user has access to
 * Includes both direct memberships and org-level access
 * Returns workspaces with the user's role attached
 */
export async function getUserWorkspaces(
  userId: string
): Promise<WorkspaceWithAccess[]> {
  // 1. Get direct workspace memberships
  const directMemberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: {
      workspace: true,
    },
  });

  const directWorkspaceIds = new Set(directMemberships.map((m) => m.workspaceId));
  const result: WorkspaceWithAccess[] = directMemberships.map((m) => ({
    ...m.workspace,
    userRole: m.role,
    viaOrg: false,
  }));

  // 2. Get org memberships and their workspaces
  const orgMemberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          workspaces: true,
        },
      },
    },
  });

  for (const orgMembership of orgMemberships) {
    const permissions = getEffectivePermissions(
      orgMembership.isOwner,
      orgMembership.permissions
    );

    // Get user's workspace assignments if they don't have canAccessAllWorkspaces
    let assignedWorkspaceIds: Set<string> | null = null;
    if (!orgMembership.isOwner && !permissions.canAccessAllWorkspaces) {
      const assignments = await prisma.workspaceAssignment.findMany({
        where: { userId },
        select: { workspaceId: true },
      });
      assignedWorkspaceIds = new Set(assignments.map((a) => a.workspaceId));
    }

    for (const workspace of orgMembership.organization.workspaces) {
      // Skip if already have direct access
      if (directWorkspaceIds.has(workspace.id)) {
        continue;
      }

      // Check if user can access this workspace via org
      let role: WorkspaceRole;
      
      if (orgMembership.isOwner) {
        role = WorkspaceRole.OWNER;
      } else if (permissions.canAccessAllWorkspaces) {
        role = WorkspaceRole.ADMIN;
      } else if (assignedWorkspaceIds?.has(workspace.id)) {
        role = WorkspaceRole.MEMBER;
      } else {
        // No access to this workspace
        continue;
      }

      result.push({
        ...workspace,
        userRole: role,
        viaOrg: true,
      });
    }
  }

  // Sort by name
  result.sort((a, b) => a.name.localeCompare(b.name));

  return result;
}

/**
 * Get all workspace IDs a user has access to
 * Includes both direct memberships and org-level access
 * Useful for filtering queries
 */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  const workspaces = await getUserWorkspaces(userId);
  return workspaces.map((w) => w.id);
}

/**
 * Get all workspaces in an organization that a user can access
 * Respects org permissions and workspace assignments
 */
export async function getOrgWorkspacesForUser(
  userId: string,
  organizationId: string
): Promise<WorkspaceWithAccess[]> {
  const allWorkspaces = await getUserWorkspaces(userId);
  
  // Filter to only workspaces in this org
  const orgWorkspaceIds = await prisma.workspace.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const orgWorkspaceIdSet = new Set(orgWorkspaceIds.map((w) => w.id));
  
  return allWorkspaces.filter((w) => orgWorkspaceIdSet.has(w.id));
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
