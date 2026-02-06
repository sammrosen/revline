import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { requireOrgAccess, OrgAccessError } from '@/app/_lib/organization-access';
import { z } from 'zod';

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/, {
    message: 'Slug must start with a letter and contain only lowercase letters, numbers, and hyphens',
  }).optional(),
});

/**
 * GET /api/v1/organizations/[id] - Get organization details
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
    const access = await requireOrgAccess(userId, id);

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            workspaces: true,
            templates: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        memberCount: organization._count.members,
        workspaceCount: organization._count.workspaces,
        templateCount: organization._count.templates,
      },
      access: {
        isOwner: access.isOwner,
        permissions: access.permissions,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Get organization error:', error);
    return NextResponse.json(
      { error: 'Failed to get organization' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/organizations/[id] - Update organization
 * Requires owner permission
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify user is org owner
    const access = await requireOrgAccess(userId, id);
    if (!access.isOwner) {
      return NextResponse.json(
        { error: 'Only organization owners can update settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = UpdateOrgSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { name, slug } = validation.data;

    // Check if new slug already exists (if changing)
    if (slug) {
      const existing = await prisma.organization.findFirst({
        where: {
          slug,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Organization slug already exists' },
          { status: 409 }
        );
      }
    }

    const organization = await prisma.organization.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
      },
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Update organization error:', error);
    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/organizations/[id] - Delete organization
 * Requires owner permission, fails if org has workspaces
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify user is org owner
    const access = await requireOrgAccess(userId, id);
    if (!access.isOwner) {
      return NextResponse.json(
        { error: 'Only organization owners can delete the organization' },
        { status: 403 }
      );
    }

    // Check if org has workspaces
    const workspaceCount = await prisma.workspace.count({
      where: { organizationId: id },
    });

    if (workspaceCount > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete organization with existing workspaces',
          code: 'HAS_WORKSPACES',
          workspaceCount,
        },
        { status: 400 }
      );
    }

    // Delete organization (cascade deletes members and templates)
    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Delete organization error:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
