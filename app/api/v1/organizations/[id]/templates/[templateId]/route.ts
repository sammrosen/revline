import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { requireOrgAccess, OrgAccessError } from '@/app/_lib/organization-access';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  schema: z.object({
    fields: z.array(z.object({
      key: z.string(),
      label: z.string(),
      description: z.string().optional(),
      default: z.string().optional(),
      maxLength: z.number().optional(),
      placeholder: z.string().optional(),
      multiline: z.boolean().optional(),
    })),
  }).optional(),
  defaultCopy: z.record(z.string(), z.string()).optional(),
  defaultBranding: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    logo: z.string().optional(),
    fontFamily: z.string().optional(),
  }).optional().nullable(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/v1/organizations/[id]/templates/[templateId] - Get template details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, templateId } = await params;

  try {
    // Verify user has access to this org
    await requireOrgAccess(userId, id);

    const template = await prisma.organizationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.organizationId !== id) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      template: {
        id: template.id,
        type: template.type,
        name: template.name,
        schema: template.schema,
        defaultCopy: template.defaultCopy,
        defaultBranding: template.defaultBranding,
        enabled: template.enabled,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Get template error:', error);
    return NextResponse.json(
      { error: 'Failed to get template' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/organizations/[id]/templates/[templateId] - Update template
 * Requires canManageTemplates permission or owner
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, templateId } = await params;

  try {
    // Verify user has permission to manage templates
    const access = await requireOrgAccess(userId, id);
    if (!access.isOwner && !access.permissions.canManageTemplates) {
      return NextResponse.json(
        { error: 'You do not have permission to manage templates' },
        { status: 403 }
      );
    }

    const existing = await prisma.organizationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing || existing.organizationId !== id) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = UpdateTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { name, schema, defaultCopy, defaultBranding, enabled } = validation.data;

    const template = await prisma.organizationTemplate.update({
      where: { id: templateId },
      data: {
        ...(name !== undefined && { name }),
        ...(schema !== undefined && { schema: schema as Prisma.InputJsonValue }),
        ...(defaultCopy !== undefined && { defaultCopy: defaultCopy as Prisma.InputJsonValue }),
        ...(defaultBranding !== undefined && { 
          defaultBranding: defaultBranding === null 
            ? Prisma.JsonNull 
            : (defaultBranding as Prisma.InputJsonValue) 
        }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    return NextResponse.json({
      template: {
        id: template.id,
        type: template.type,
        name: template.name,
        schema: template.schema,
        defaultCopy: template.defaultCopy,
        defaultBranding: template.defaultBranding,
        enabled: template.enabled,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Update template error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/organizations/[id]/templates/[templateId] - Delete template
 * Requires canManageTemplates permission or owner
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, templateId } = await params;

  try {
    // Verify user has permission to manage templates
    const access = await requireOrgAccess(userId, id);
    if (!access.isOwner && !access.permissions.canManageTemplates) {
      return NextResponse.json(
        { error: 'You do not have permission to manage templates' },
        { status: 403 }
      );
    }

    const existing = await prisma.organizationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing || existing.organizationId !== id) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.organizationTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Delete template error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
