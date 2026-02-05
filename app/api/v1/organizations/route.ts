import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getUserOrgs, addUserToOrg } from '@/app/_lib/organization-access';
import { z } from 'zod';

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z][a-z0-9-]*$/, {
    message: 'Slug must start with a letter and contain only lowercase letters, numbers, and hyphens',
  }),
});

/**
 * GET /api/v1/organizations - List user's organizations
 */
export async function GET() {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const organizations = await getUserOrgs(userId);
    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('List organizations error:', error);
    return NextResponse.json(
      { error: 'Failed to list organizations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/organizations - Create a new organization
 * User becomes owner automatically
 */
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = CreateOrgSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { name, slug } = validation.data;

    // Check if slug already exists
    const existing = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Organization slug already exists' },
        { status: 409 }
      );
    }

    // Create organization and add user as owner
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
      },
    });

    // Add creator as owner
    await addUserToOrg(organization.id, userId, { isOwner: true });

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    });
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
