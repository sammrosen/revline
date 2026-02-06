/**
 * Organization Access Authorization
 * 
 * This module provides functions to check and enforce user access to organizations.
 * Organizations are the top-level tenant - they own workspaces and templates.
 * 
 * Access model:
 * - Owners have full control (implicit all permissions)
 * - Members have explicit permission toggles
 * - Workspace access can be granted via org membership + assignment
 */

import { prisma } from './db';
import {
  OrgPermissions,
  OrganizationAccess,
  OrganizationWithAccess,
  DEFAULT_MEMBER_PERMISSIONS,
  OWNER_PERMISSIONS,
} from './types';

// =============================================================================
// PERMISSION HELPERS
// =============================================================================

/**
 * Parse permissions from JSON, with defaults for missing fields
 */
export function parsePermissions(permissionsJson: unknown): OrgPermissions {
  const defaults = DEFAULT_MEMBER_PERMISSIONS;
  
  if (!permissionsJson || typeof permissionsJson !== 'object') {
    return defaults;
  }
  
  const json = permissionsJson as Record<string, unknown>;
  
  return {
    canManageIntegrations: typeof json.canManageIntegrations === 'boolean' 
      ? json.canManageIntegrations : defaults.canManageIntegrations,
    canManageWorkflows: typeof json.canManageWorkflows === 'boolean' 
      ? json.canManageWorkflows : defaults.canManageWorkflows,
    canManageTemplates: typeof json.canManageTemplates === 'boolean' 
      ? json.canManageTemplates : defaults.canManageTemplates,
    canInviteMembers: typeof json.canInviteMembers === 'boolean' 
      ? json.canInviteMembers : defaults.canInviteMembers,
    canCreateWorkspaces: typeof json.canCreateWorkspaces === 'boolean' 
      ? json.canCreateWorkspaces : defaults.canCreateWorkspaces,
    canAccessAllWorkspaces: typeof json.canAccessAllWorkspaces === 'boolean' 
      ? json.canAccessAllWorkspaces : defaults.canAccessAllWorkspaces,
  };
}

/**
 * Get effective permissions for a user (owner gets all, member gets explicit)
 */
export function getEffectivePermissions(isOwner: boolean, permissionsJson: unknown): OrgPermissions {
  if (isOwner) {
    return OWNER_PERMISSIONS;
  }
  return parsePermissions(permissionsJson);
}

// =============================================================================
// ORGANIZATION ACCESS
// =============================================================================

/**
 * Get a user's access to a specific organization
 * Returns null if user has no membership
 */
export async function getOrgAccess(
  userId: string,
  organizationId: string
): Promise<OrganizationAccess | null> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: {
      isOwner: true,
      permissions: true,
    },
  });

  if (!membership) {
    return null;
  }

  return {
    organizationId,
    userId,
    isOwner: membership.isOwner,
    permissions: getEffectivePermissions(membership.isOwner, membership.permissions),
  };
}

/**
 * Check if user has a specific permission in an organization
 * Owners always return true
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: keyof OrgPermissions
): Promise<boolean> {
  const access = await getOrgAccess(userId, organizationId);
  if (!access) return false;
  return access.permissions[permission];
}

/**
 * Error codes for organization access failures
 */
export const OrgAccessError = {
  NOT_A_MEMBER: 'NOT_A_MEMBER',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type OrgAccessErrorCode = typeof OrgAccessError[keyof typeof OrgAccessError];

/**
 * Require user access to an organization with optional permission check
 * Throws an error if access is denied
 */
export async function requireOrgAccess(
  userId: string,
  organizationId: string,
  permission?: keyof OrgPermissions
): Promise<OrganizationAccess> {
  const access = await getOrgAccess(userId, organizationId);
  
  if (!access) {
    throw new Error(OrgAccessError.NOT_A_MEMBER);
  }
  
  if (permission && !access.permissions[permission]) {
    throw new Error(OrgAccessError.PERMISSION_DENIED);
  }
  
  return access;
}

// =============================================================================
// USER'S ORGANIZATIONS
// =============================================================================

/**
 * Get all organizations a user has access to
 * Returns organizations with the user's access level attached
 */
export async function getUserOrgs(userId: string): Promise<OrganizationWithAccess[]> {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: true,
    },
    orderBy: {
      organization: {
        name: 'asc',
      },
    },
  });

  return memberships.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    isOwner: membership.isOwner,
    permissions: getEffectivePermissions(membership.isOwner, membership.permissions),
  }));
}

/**
 * Get the user's current/default organization
 * For now, returns the first org they're a member of
 * Future: could be stored in session/cookie for org switching
 */
export async function getCurrentOrg(userId: string): Promise<OrganizationWithAccess | null> {
  const orgs = await getUserOrgs(userId);
  return orgs[0] || null;
}

/**
 * Get organization by ID with user's access attached
 * Returns null if org doesn't exist or user has no access
 */
export async function getOrgWithAccess(
  userId: string,
  organizationId: string
): Promise<OrganizationWithAccess | null> {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    include: {
      organization: true,
    },
  });

  if (!membership) {
    return null;
  }

  return {
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    isOwner: membership.isOwner,
    permissions: getEffectivePermissions(membership.isOwner, membership.permissions),
  };
}

// =============================================================================
// WORKSPACE ASSIGNMENT HELPERS
// =============================================================================

/**
 * Check if a user is explicitly assigned to a workspace
 * Used when org member doesn't have canAccessAllWorkspaces
 */
export async function isUserAssignedToWorkspace(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const assignment = await prisma.workspaceAssignment.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });
  return !!assignment;
}

/**
 * Get all workspace IDs a user is explicitly assigned to
 */
export async function getUserAssignedWorkspaceIds(userId: string): Promise<string[]> {
  const assignments = await prisma.workspaceAssignment.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return assignments.map((a) => a.workspaceId);
}

// =============================================================================
// MEMBER MANAGEMENT
// =============================================================================

/**
 * Add a user to an organization
 */
export async function addUserToOrg(
  organizationId: string,
  userId: string,
  options?: {
    isOwner?: boolean;
    permissions?: Partial<OrgPermissions>;
  }
): Promise<void> {
  const permissions = {
    ...DEFAULT_MEMBER_PERMISSIONS,
    ...(options?.permissions || {}),
  };

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    create: {
      organizationId,
      userId,
      isOwner: options?.isOwner || false,
      permissions,
    },
    update: {
      isOwner: options?.isOwner,
      permissions,
    },
  });
}

/**
 * Remove a user from an organization
 * Also removes their workspace assignments within that org
 */
export async function removeUserFromOrg(
  organizationId: string,
  userId: string
): Promise<void> {
  // Get all workspace IDs in this org
  const orgWorkspaces = await prisma.workspace.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const workspaceIds = orgWorkspaces.map((w) => w.id);

  // Remove workspace assignments in this org
  if (workspaceIds.length > 0) {
    await prisma.workspaceAssignment.deleteMany({
      where: {
        userId,
        workspaceId: { in: workspaceIds },
      },
    });
  }

  // Remove org membership
  await prisma.organizationMember.delete({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  }).catch(() => {
    // Ignore if membership doesn't exist
  });
}

/**
 * Update a user's permissions in an organization
 */
export async function updateMemberPermissions(
  organizationId: string,
  userId: string,
  permissions: Partial<OrgPermissions>
): Promise<void> {
  const existing = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    select: { permissions: true },
  });

  if (!existing) {
    throw new Error(OrgAccessError.NOT_A_MEMBER);
  }

  const currentPermissions = parsePermissions(existing.permissions);
  const updatedPermissions = {
    ...currentPermissions,
    ...permissions,
  };

  await prisma.organizationMember.update({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    data: {
      permissions: updatedPermissions,
    },
  });
}

/**
 * Get all members of an organization
 */
export async function getOrgMembers(organizationId: string) {
  return prisma.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: [
      { isOwner: 'desc' },  // Owners first
      { createdAt: 'asc' }, // Then by join date
    ],
  });
}

// =============================================================================
// WORKSPACE ASSIGNMENT MANAGEMENT
// =============================================================================

/**
 * Assign a user to a workspace
 */
export async function assignUserToWorkspace(
  userId: string,
  workspaceId: string
): Promise<void> {
  await prisma.workspaceAssignment.upsert({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    create: {
      userId,
      workspaceId,
    },
    update: {},
  });
}

/**
 * Unassign a user from a workspace
 */
export async function unassignUserFromWorkspace(
  userId: string,
  workspaceId: string
): Promise<void> {
  await prisma.workspaceAssignment.delete({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  }).catch(() => {
    // Ignore if assignment doesn't exist
  });
}

/**
 * Get all workspace assignments for an organization
 */
export async function getOrgWorkspaceAssignments(organizationId: string) {
  const workspaces = await prisma.workspace.findMany({
    where: { organizationId },
    select: { id: true },
  });
  const workspaceIds = workspaces.map((w) => w.id);

  return prisma.workspaceAssignment.findMany({
    where: {
      workspaceId: { in: workspaceIds },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}
