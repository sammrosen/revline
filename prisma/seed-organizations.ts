/**
 * Organization Seed Script
 * 
 * Run with: npx tsx prisma/seed-organizations.ts
 * 
 * This script:
 * 1. Creates the default organization
 * 2. Links all existing workspaces to that organization
 * 3. Creates organization membership for existing users as owners
 * 4. Creates default organization templates from code schemas
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================================
// DEFAULT TEMPLATE SCHEMAS (from app/_lib/templates/schemas.ts)
// =============================================================================

const BOOKING_TEMPLATE = {
  type: 'booking',
  name: 'Booking Form',
  schema: {
    fields: [
      {
        key: 'headline',
        label: 'Page Headline',
        description: 'Main heading displayed at the top of the booking page',
        default: 'Book Your Session',
        maxLength: 60,
        placeholder: 'e.g., Book Your Training Session',
      },
      {
        key: 'subhead',
        label: 'Subheadline',
        description: 'Optional text below the headline',
        default: 'Select a time that works for you',
        maxLength: 120,
        placeholder: 'e.g., Schedule a session with our certified trainers',
      },
      {
        key: 'submitButton',
        label: 'Submit Button Text',
        description: 'Text shown on the submit button',
        default: 'Book Now',
        maxLength: 30,
        placeholder: 'e.g., Book Now',
      },
      {
        key: 'successTitle',
        label: 'Success Page Title',
        description: 'Title shown after successful submission',
        default: 'Booking Requested!',
        maxLength: 60,
        placeholder: 'e.g., Booking Requested!',
      },
      {
        key: 'successMessage',
        label: 'Success Message',
        description: 'Message shown on the success page',
        default: 'Check your email to confirm your booking.',
        maxLength: 200,
        placeholder: 'e.g., Check your email for confirmation',
        multiline: true,
      },
      {
        key: 'footerText',
        label: 'Footer Text',
        description: 'Text shown in the page footer',
        default: '',
        maxLength: 50,
        placeholder: 'e.g., Powered by Your Company',
      },
    ],
  },
  defaultCopy: {
    headline: 'Book Your Session',
    subhead: 'Select a time that works for you',
    submitButton: 'Book Now',
    successTitle: 'Booking Requested!',
    successMessage: 'Check your email to confirm your booking.',
    footerText: '',
  },
  defaultBranding: {
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    backgroundColor: '#F9FAFB',
    logo: '',
    fontFamily: 'inter',
  },
};

const SIGNUP_TEMPLATE = {
  type: 'signup',
  name: 'Membership Signup',
  schema: {
    fields: [
      {
        key: 'smsConsent',
        label: 'SMS Consent Text',
        description: 'Marketing consent checkbox text',
        default: 'I agree to receive marketing messages via SMS.',
        maxLength: 300,
        placeholder: 'I agree to receive marketing messages...',
        multiline: true,
      },
      {
        key: 'disclaimer',
        label: 'Page Disclaimer',
        description: 'Disclaimer text shown at bottom of page',
        default: '',
        maxLength: 200,
        placeholder: 'Results may vary...',
      },
      {
        key: 'submitButton',
        label: 'Submit Button Text',
        description: 'Text on the final submit button',
        default: 'Complete Enrollment',
        maxLength: 30,
        placeholder: 'e.g., Complete Enrollment',
      },
      {
        key: 'successTitle',
        label: 'Success Page Title',
        description: 'Title shown after successful enrollment',
        default: 'Welcome!',
        maxLength: 60,
        placeholder: 'e.g., Welcome!',
      },
      {
        key: 'successMessage',
        label: 'Success Message',
        description: 'Message shown on the confirmation page',
        default: 'Your membership is now active.',
        maxLength: 200,
        placeholder: 'Your membership is now active...',
        multiline: true,
      },
    ],
  },
  defaultCopy: {
    smsConsent: 'I agree to receive marketing messages via SMS.',
    disclaimer: '',
    submitButton: 'Complete Enrollment',
    successTitle: 'Welcome!',
    successMessage: 'Your membership is now active.',
  },
  defaultBranding: null,
};

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function main() {
  console.log('🏢 Organization Seed Script\n');

  // Connect to database
  try {
    await prisma.$connect();
    console.log('✓ Connected to database\n');
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    process.exit(1);
  }

  // 1. Create default organization
  console.log('📦 Step 1: Create Default Organization');
  
  let organization = await prisma.organization.findFirst();
  
  if (organization) {
    console.log(`   ✓ Organization "${organization.name}" already exists\n`);
  } else {
    organization = await prisma.organization.create({
      data: {
        name: 'Rosen Systems LLC',
        slug: 'rosen-systems',
      },
    });
    console.log(`   ✓ Organization "Rosen Systems LLC" created\n`);
  }

  // 2. Link all existing workspaces to the organization
  console.log('📦 Step 2: Link Workspaces to Organization');
  
  const workspacesWithoutOrg = await prisma.workspace.findMany({
    where: { organizationId: null },
  });

  if (workspacesWithoutOrg.length === 0) {
    console.log('   ✓ All workspaces already linked to an organization\n');
  } else {
    await prisma.workspace.updateMany({
      where: { organizationId: null },
      data: { organizationId: organization.id },
    });
    console.log(`   ✓ Linked ${workspacesWithoutOrg.length} workspace(s) to "${organization.name}"\n`);
  }

  // 3. Create organization membership for existing users
  console.log('📦 Step 3: Create Organization Memberships');
  
  const users = await prisma.user.findMany();
  let membershipsCreated = 0;

  for (const user of users) {
    const existingMembership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
    });

    if (!existingMembership) {
      // First user becomes owner, others get default permissions
      const isFirstUser = membershipsCreated === 0;
      
      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          isOwner: isFirstUser,
          permissions: isFirstUser ? {} : {
            canManageIntegrations: false,
            canManageWorkflows: true,
            canManageTemplates: false,
            canInviteMembers: false,
            canCreateWorkspaces: false,
            canAccessAllWorkspaces: false,
          },
        },
      });
      membershipsCreated++;
    }
  }

  if (membershipsCreated > 0) {
    console.log(`   ✓ Created ${membershipsCreated} organization membership(s)\n`);
  } else {
    console.log('   ✓ All users already have organization memberships\n');
  }

  // 4. Create workspace assignments for existing workspace members
  console.log('📦 Step 4: Create Workspace Assignments');
  
  const workspaceMembers = await prisma.workspaceMember.findMany();
  let assignmentsCreated = 0;

  for (const member of workspaceMembers) {
    const existingAssignment = await prisma.workspaceAssignment.findUnique({
      where: {
        userId_workspaceId: {
          userId: member.userId,
          workspaceId: member.workspaceId,
        },
      },
    });

    if (!existingAssignment) {
      await prisma.workspaceAssignment.create({
        data: {
          userId: member.userId,
          workspaceId: member.workspaceId,
        },
      });
      assignmentsCreated++;
    }
  }

  if (assignmentsCreated > 0) {
    console.log(`   ✓ Created ${assignmentsCreated} workspace assignment(s)\n`);
  } else {
    console.log('   ✓ All workspace assignments already exist\n');
  }

  // 5. Create default organization templates
  console.log('📦 Step 5: Create Organization Templates');
  
  const templates = [BOOKING_TEMPLATE, SIGNUP_TEMPLATE];
  let templatesCreated = 0;

  for (const template of templates) {
    const existingTemplate = await prisma.organizationTemplate.findUnique({
      where: {
        organizationId_type: {
          organizationId: organization.id,
          type: template.type,
        },
      },
    });

    if (!existingTemplate) {
      await prisma.organizationTemplate.create({
        data: {
          organizationId: organization.id,
          type: template.type,
          name: template.name,
          schema: template.schema as Prisma.InputJsonValue,
          defaultCopy: template.defaultCopy as Prisma.InputJsonValue,
          defaultBranding: template.defaultBranding === null 
            ? Prisma.JsonNull 
            : (template.defaultBranding as Prisma.InputJsonValue),
          enabled: true,
        },
      });
      templatesCreated++;
      console.log(`   ✓ Created "${template.name}" template`);
    }
  }

  if (templatesCreated === 0) {
    console.log('   ✓ All templates already exist\n');
  } else {
    console.log(`\n   ✓ Created ${templatesCreated} template(s)\n`);
  }

  console.log('✅ Organization seed complete!\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
