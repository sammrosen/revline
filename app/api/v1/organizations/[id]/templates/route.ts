import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { requireOrgAccess, OrgAccessError } from '@/app/_lib/organization-access';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const CreateTemplateSchema = z.object({
  type: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_-]*$/, {
    message: 'Type must start with a letter and contain only lowercase letters, numbers, underscores, and hyphens',
  }),
  name: z.string().min(1).max(100),
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
  }),
  defaultCopy: z.record(z.string(), z.string()),
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
 * GET /api/v1/organizations/[id]/templates - List organization templates
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

    const templates = await prisma.organizationTemplate.findMany({
      where: { organizationId: id },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        type: t.type,
        name: t.name,
        schema: t.schema,
        defaultCopy: t.defaultCopy,
        defaultBranding: t.defaultBranding,
        enabled: t.enabled,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('List templates error:', error);
    return NextResponse.json(
      { error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/organizations/[id]/templates - Create a new template
 * Requires canManageTemplates permission or owner
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
    // Verify user has permission to manage templates
    const access = await requireOrgAccess(userId, id);
    if (!access.isOwner && !access.permissions.canManageTemplates) {
      return NextResponse.json(
        { error: 'You do not have permission to manage templates' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = CreateTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { type, name, schema, defaultCopy, defaultBranding, enabled } = validation.data;

    // Check if template type already exists for this org
    const existing = await prisma.organizationTemplate.findUnique({
      where: {
        organizationId_type: {
          organizationId: id,
          type,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A template with this type already exists' },
        { status: 409 }
      );
    }

    const template = await prisma.organizationTemplate.create({
      data: {
        organizationId: id,
        type,
        name,
        schema: schema as Prisma.InputJsonValue,
        defaultCopy: defaultCopy as Prisma.InputJsonValue,
        defaultBranding: defaultBranding === null 
          ? Prisma.JsonNull 
          : (defaultBranding as Prisma.InputJsonValue),
        enabled: enabled ?? true,
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
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === OrgAccessError.NOT_A_MEMBER) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
