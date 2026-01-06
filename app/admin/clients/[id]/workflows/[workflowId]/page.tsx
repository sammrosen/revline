import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import Link from 'next/link';
import { WorkflowEditor } from '../workflow-editor';
import { IntegrationType } from '@prisma/client';
import { MailerLiteMeta, isMailerLiteMeta } from '@/app/_lib/types';
import { WorkflowAction } from '@/app/_lib/workflow';

export const dynamic = 'force-dynamic';

async function getWorkflowData(clientId: string, workflowId: string) {
  const [client, workflow] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      include: {
        integrations: {
          select: {
            integration: true,
            meta: true,
          },
        },
      },
    }),
    prisma.workflow.findUnique({
      where: { id: workflowId },
    }),
  ]);

  return { client, workflow };
}

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string; workflowId: string }>;
}) {
  const { id, workflowId } = await params;
  const { client, workflow } = await getWorkflowData(id, workflowId);

  if (!client || !workflow) {
    notFound();
  }

  // Verify workflow belongs to this client
  if (workflow.clientId !== client.id) {
    notFound();
  }

  // Get configured integrations
  const configuredIntegrations = client.integrations.map((i) => i.integration);

  // Get MailerLite groups if configured
  const mailerliteIntegration = client.integrations.find(
    (i) => i.integration === IntegrationType.MAILERLITE
  );
  const mailerliteMeta = mailerliteIntegration?.meta as MailerLiteMeta | null;
  const mailerliteGroups = isMailerLiteMeta(mailerliteMeta)
    ? mailerliteMeta.groups
    : {};

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4 mb-4">
            <Link
              href={`/admin/clients/${client.id}/workflows`}
              className="text-zinc-400 hover:text-white text-sm inline-block"
            >
              ← Back to Workflows
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Edit Workflow
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{workflow.name}</p>
        </div>

        {/* Editor */}
        <WorkflowEditor
          clientId={client.id}
          workflowId={workflow.id}
          initialData={{
            name: workflow.name,
            description: workflow.description,
            enabled: workflow.enabled,
            triggerAdapter: workflow.triggerAdapter,
            triggerOperation: workflow.triggerOperation,
            triggerFilter: workflow.triggerFilter as Record<string, unknown> | null,
            actions: workflow.actions as unknown as WorkflowAction[],
          }}
          configuredIntegrations={configuredIntegrations}
          mailerliteGroups={mailerliteGroups}
        />
      </div>
    </div>
  );
}

