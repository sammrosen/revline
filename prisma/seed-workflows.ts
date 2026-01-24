/**
 * Workflow Migration Script
 *
 * Creates default workflows for existing clients based on their integration config.
 * Run with: npx ts-node prisma/seed-workflows.ts
 */

import { PrismaClient, IntegrationType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface WorkflowTemplate {
  name: string;
  description: string;
  triggerAdapter: string;
  triggerOperation: string;
  triggerFilter?: Record<string, unknown>;
  actions: Array<{
    adapter: string;
    operation: string;
    params: Record<string, unknown>;
  }>;
  requiresIntegration?: IntegrationType;
}

// Default workflow templates
const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ABC Ignite Booking Flow (Sync Workflow)
  {
    name: 'ABC Ignite Booking',
    description: 'Creates appointments in ABC Ignite when a booking is requested (sync workflow)',
    triggerAdapter: 'booking',
    triggerOperation: 'create_booking',
    actions: [
      {
        adapter: 'abc_ignite',
        operation: 'create_appointment',
        params: {
          employeeId: '{{trigger.payload.employeeId}}',
          eventTypeId: '{{trigger.payload.eventTypeId}}',
          levelId: '{{trigger.payload.levelId}}',
          startTime: '{{trigger.payload.startTime}}',
          memberId: '{{trigger.payload.memberId}}',
        },
      },
    ],
    requiresIntegration: IntegrationType.ABC_IGNITE,
  },
  // Email Capture Flow
  {
    name: 'Email Capture Flow',
    description: 'When a lead submits their email on a landing page, create a lead and add to MailerLite',
    triggerAdapter: 'revline',
    triggerOperation: 'email_captured',
    actions: [
      { adapter: 'revline', operation: 'create_lead', params: {} },
      { adapter: 'mailerlite', operation: 'add_to_group', params: { group: 'leads' } },
    ],
    requiresIntegration: IntegrationType.MAILERLITE,
  },
  // Calendly Booking Flow
  {
    name: 'Calendly Booking Flow',
    description: 'When someone books a call, update lead stage to BOOKED',
    triggerAdapter: 'calendly',
    triggerOperation: 'booking_created',
    actions: [
      { adapter: 'revline', operation: 'create_lead', params: { source: 'calendly' } },
      { adapter: 'revline', operation: 'update_lead_stage', params: { stage: 'BOOKED' } },
    ],
    requiresIntegration: IntegrationType.CALENDLY,
  },
  // Calendly Cancellation Flow
  {
    name: 'Calendly Cancellation Flow',
    description: 'When a booking is canceled, revert lead stage to CAPTURED',
    triggerAdapter: 'calendly',
    triggerOperation: 'booking_canceled',
    actions: [
      { adapter: 'revline', operation: 'update_lead_stage', params: { stage: 'CAPTURED' } },
    ],
    requiresIntegration: IntegrationType.CALENDLY,
  },
  // Stripe Payment Flow
  {
    name: 'Stripe Payment Flow',
    description: 'When a payment succeeds, update lead stage to PAID and add to customers group',
    triggerAdapter: 'stripe',
    triggerOperation: 'payment_succeeded',
    actions: [
      { adapter: 'revline', operation: 'create_lead', params: { source: 'stripe' } },
      { adapter: 'revline', operation: 'update_lead_stage', params: { stage: 'PAID' } },
      { adapter: 'mailerlite', operation: 'add_to_group', params: { group: 'customers' } },
    ],
    requiresIntegration: IntegrationType.STRIPE,
  },
];

async function seedWorkflows() {
  console.log('Starting workflow migration...\n');

  // Get all clients with their integrations
  const clients = await prisma.workspace.findMany({
    include: {
      integrations: {
        select: {
          integration: true,
          meta: true,
        },
      },
      workflows: {
        select: {
          name: true,
        },
      },
    },
  });

  console.log(`Found ${clients.length} clients\n`);

  let totalCreated = 0;

  for (const client of clients) {
    console.log(`Processing client: ${client.name} (${client.slug})`);

    const configuredIntegrations = client.integrations.map((i) => i.integration);
    const existingWorkflowNames = client.workflows.map((w) => w.name);

    let clientWorkflowsCreated = 0;

    for (const template of WORKFLOW_TEMPLATES) {
      // Skip if workflow already exists
      if (existingWorkflowNames.includes(template.name)) {
        console.log(`  - Skipping "${template.name}" (already exists)`);
        continue;
      }

      // Skip if required integration not configured
      if (
        template.requiresIntegration &&
        !configuredIntegrations.includes(template.requiresIntegration)
      ) {
        console.log(
          `  - Skipping "${template.name}" (missing ${template.requiresIntegration})`
        );
        continue;
      }

      // Check if MailerLite actions reference groups that exist
      const mailerliteIntegration = client.integrations.find(
        (i) => i.integration === IntegrationType.MAILERLITE
      );
      const mailerliteMeta = mailerliteIntegration?.meta as {
        groups?: Record<string, unknown>;
      } | null;

      // Adjust actions based on available groups
      const adjustedActions = template.actions.map((action) => {
        if (action.adapter === 'mailerlite' && action.operation === 'add_to_group') {
          const groupKey = action.params.group as string;
          // Check if group exists in config
          if (!mailerliteMeta?.groups?.[groupKey]) {
            // Try to find a suitable fallback
            const availableGroups = Object.keys(mailerliteMeta?.groups || {});
            if (availableGroups.length > 0) {
              console.log(
                `    - Group "${groupKey}" not found, using "${availableGroups[0]}"`
              );
              return { ...action, params: { group: availableGroups[0] } };
            }
          }
        }
        return action;
      });

      // Create workflow (disabled by default - admin should review and enable)
      await prisma.workflow.create({
        data: {
          workspaceId: client.id,
          name: template.name,
          description: template.description,
          enabled: false, // Start disabled so admin can review
          triggerAdapter: template.triggerAdapter,
          triggerOperation: template.triggerOperation,
          triggerFilter: template.triggerFilter
            ? (template.triggerFilter as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          actions: adjustedActions as unknown as Prisma.InputJsonValue,
        },
      });

      console.log(`  + Created "${template.name}" (disabled)`);
      clientWorkflowsCreated++;
      totalCreated++;
    }

    if (clientWorkflowsCreated === 0) {
      console.log('  (no new workflows created)');
    }
    console.log('');
  }

  console.log(`\nMigration complete! Created ${totalCreated} workflows.`);
  console.log('Remember to review and enable workflows in the admin UI.');
}

seedWorkflows()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

