import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { 
  requireOrgAccess, 
  getOrgMembers, 
  addUserToOrg,
  OrgAccessError,
  parsePermissions,
} from '@/app/_lib/organization-access';
import { DEFAULT_MEMBER_PERMISSIONS, OrgPermissions } from '@/app/_lib/types';
import { z } from 'zod';

const AddMemberSchema = z.object({
  email: z.string().email(),
  permissions: z.object({
    canManageIntegrations: z.boolean().optional(),
    canManageWorkflows: z.boolean().optional(),
    canManageTemplates: z.boolean().optional(),
    canInviteMembers: z.boolean().optional(),
    canCreateWorkspaces: z.boolean().optional(),
    canAccessAllWorkspaces: z.boolean().optional(),
  }).optional(),
});

/**
 * GET /api/v1/organizations/[id]/members - List organization members
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify user has access to this org
    await requireOrgAccess(userId, id);

    const members = await getOrgMembers(id);

    return NextResponse.json({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        isOwner: m.isOwner,
        permissions: parsePermissions(m.permissions),
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('List members error:', error);
    return NextResponse.json(
      { error: 'Failed to list members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/organizations/[id]/members - Add a member to organization
 * Requires canInviteMembers permission or owner
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify user has permission to invite
    const access = await requireOrgAccess(userId, id);
    if (!access.isOwner && !access.permissions.canInviteMembers) {
      return NextResponse.json(
        { error: 'You do not have permission to invite members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = AddMemberSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { email, permissions } = validation.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found. They must create an account first.' },
        { status: 404 }
      );
    }

    // Check if already a member
    const existing = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: id,
          userId: user.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 409 }
      );
    }

    // Add member with specified or default permissions
    const memberPermissions: OrgPermissions = {
      ...DEFAULT_MEMBER_PERMISSIONS,
      ...(permissions || {}),
    };

    await addUserToOrg(id, user.id, { permissions: memberPermissions });

    return NextResponse.json({
      member: {
        userId: user.id,
        email: user.email,
        name: user.name,
        isOwner: false,
        permissions: memberPermissions,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Add member error:', error);
    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 }
    );
  }
}
