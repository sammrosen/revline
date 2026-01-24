/**
 * Migration Script: RevLine Workflows to Capture
 * 
 * This script migrates existing workflows from the legacy 'revline' adapter
 * to the new unified 'capture' adapter.
 * 
 * Run with: npx tsx prisma/migrate-workflows-to-capture.ts
 * 
 * What it does:
 * 1. Finds all workflows with triggerAdapter: 'revline'
 * 2. Updates them to use triggerAdapter: 'capture'
 * 3. Logs the migration results
 * 
 * This is a one-time migration. After running, all workflows will use
 * the capture system for form triggers.
 * 
 * Note: The workflow still needs a matching WorkspaceForm with the same
 * triggerName for the trigger to fire. Create forms via the Capture tab.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting workflow migration: revline → capture\n');

  // Find all workflows using revline triggers
  const revlineWorkflows = await prisma.workflow.findMany({
    where: {
      triggerAdapter: 'revline',
    },
    include: {
      workspace: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  console.log(`Found ${revlineWorkflows.length} workflows using 'revline' adapter\n`);

  if (revlineWorkflows.length === 0) {
    console.log('✅ No workflows to migrate. All done!');
    return;
  }

  // Migrate each workflow
  let migrated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const workflow of revlineWorkflows) {
    try {
      // Update to capture adapter
      await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          triggerAdapter: 'capture',
        },
      });

      console.log(`✅ Migrated: "${workflow.name}" (${workflow.workspace.slug})`);
      console.log(`   Trigger: capture.${workflow.triggerOperation}`);
      migrated++;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`❌ Failed: "${workflow.name}" - ${errorMsg}`);
      errors.push(`${workflow.name}: ${errorMsg}`);
      skipped++;
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total workflows: ${revlineWorkflows.length}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Skipped/Failed: ${skipped}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Create WorkspaceForms via Capture tab for each trigger:');
  
  // List unique triggers that need forms
  const uniqueTriggers = new Set(revlineWorkflows.map(w => w.triggerOperation));
  uniqueTriggers.forEach(trigger => {
    console.log(`   - triggerName: "${trigger}"`);
  });
  
  console.log('2. Test that workflows fire correctly');
  console.log('3. Remove deprecated revline form configuration if no longer needed');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
