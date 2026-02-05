import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { 
  requireOrgAccess, 
  updateMemberPermissions,
  removeUserFromOrg,
  OrgAccessError,
  parsePermissions,
} from '@/app/_lib/organization-access';
import { z } from 'zod';

const UpdatePermissionsSchema = z.object({
  permissions: z.object({
    canManageIntegrations: z.boolean().optional(),
    canManageWorkflows: z.boolean().optional(),
    canManageTemplates: z.boolean().optional(),
    canInviteMembers: z.boolean().optional(),
    canCreateWorkspaces: z.boolean().optional(),
    canAccessAllWorkspaces: z.boolean().optional(),
  }),
});

/**
 * PATCH /api/v1/organizations/[id]/members/[memberId] - Update member permissions
 * Requires owner permission
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, memberId } = await params;

  try {
    // Verify user is org owner
    const access = await requireOrgAccess(userId, id);
    if (!access.isOwner) {
      return NextResponse.json(
        { error: 'Only organization owners can modify member permissions' },
        { status: 403 }
      );
    }

    // Get the member to update
    const member = await prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!member || member.organizationId !== id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot modify owner permissions
    if (member.isOwner) {
      return NextResponse.json(
        { error: 'Cannot modify owner permissions' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validation = UpdatePermissionsSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    await updateMemberPermissions(id, member.userId, validation.data.permissions);

    // Fetch updated member
    const updated = await prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return NextResponse.json({
      member: {
        id: updated!.id,
        userId: updated!.userId,
        email: updated!.user.email,
        name: updated!.user.name,
        isOwner: updated!.isOwner,
        permissions: parsePermissions(updated!.permissions),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Update member error:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/organizations/[id]/members/[memberId] - Remove member from organization
 * Requires owner permission (cannot remove yourself as owner)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, memberId } = await params;

  try {
    // Verify user is org owner
    const access = await requireOrgAccess(userId, id);
    if (!access.isOwner) {
      return NextResponse.json(
        { error: 'Only organization owners can remove members' },
        { status: 403 }
      );
    }

    // Get the member to remove
    const member = await prisma.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.organizationId !== id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot remove yourself as owner
    if (member.userId === userId && member.isOwner) {
      return NextResponse.json(
        { error: 'Cannot remove yourself as owner. Transfer ownership first.' },
        { status: 400 }
      );
    }

    await removeUserFromOrg(id, member.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Remove member error:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}
