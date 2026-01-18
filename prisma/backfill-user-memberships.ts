/**
 * Backfill Script: User Memberships
 * 
 * Run after the multi-user migration to:
 * 1. Set your email on the existing user record
 * 2. Create WorkspaceMember rows linking you (as OWNER) to all existing workspaces
 * 3. Set createdById on all workspaces to your user ID
 * 
 * Usage: npx tsx prisma/backfill-user-memberships.ts your@email.com
 */

// Load environment variables from .env.local first, then .env
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient, WorkspaceRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  
  if (!email || !email.includes('@')) {
    console.error('❌ Usage: npx tsx prisma/backfill-user-memberships.ts your@email.com');
    process.exit(1);
  }

  console.log(`\n🔧 Backfilling user memberships for: ${email}\n`);

  // Step 1: Find the existing user (formerly admin)
  const users = await prisma.user.findMany();
  
  if (users.length === 0) {
    console.error('❌ No users found in database. Run the migration first.');
    process.exit(1);
  }
  
  if (users.length > 1) {
    console.error('❌ Multiple users found. This script is for initial setup only.');
    process.exit(1);
  }

  const user = users[0];
  console.log(`✓ Found existing user: ${user.id}`);

  // Step 2: Update the user's email (replace placeholder)
  if (user.email === 'admin@placeholder.local' || user.email !== email) {
    await prisma.user.update({
      where: { id: user.id },
      data: { email: email.toLowerCase() },
    });
    console.log(`✓ Updated user email to: ${email.toLowerCase()}`);
  } else {
    console.log(`✓ User email already set: ${user.email}`);
  }

  // Step 3: Get all workspaces
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, createdById: true },
  });
  
  console.log(`✓ Found ${workspaces.length} workspace(s)`);

  // Step 4: Create WorkspaceMember entries for each workspace
  for (const workspace of workspaces) {
    // Check if membership already exists
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: workspace.id,
        },
      },
    });

    if (existingMembership) {
      console.log(`  ⊙ Membership exists for "${workspace.name}" (${existingMembership.role})`);
    } else {
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      });
      console.log(`  ✓ Created OWNER membership for "${workspace.name}"`);
    }

    // Step 5: Set createdById on workspace if not set
    if (!workspace.createdById) {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { createdById: user.id },
      });
      console.log(`  ✓ Set createdById on "${workspace.name}"`);
    }
  }

  console.log('\n✅ Backfill complete!\n');
  
  // Summary
  const membershipCount = await prisma.workspaceMember.count({
    where: { userId: user.id },
  });
  console.log(`Summary:`);
  console.log(`  - User: ${email}`);
  console.log(`  - Workspace memberships: ${membershipCount}`);
  console.log(`  - Role: OWNER (all workspaces)\n`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
