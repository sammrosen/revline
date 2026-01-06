import { notFound } from 'next/navigation';
import { prisma } from '@/app/_lib/db';
import Link from 'next/link';
import { WorkflowEditor } from '../workflow-editor';
import { IntegrationType } from '@prisma/client';
import { MailerLiteMeta, isMailerLiteMeta } from '@/app/_lib/types';

export const dynamic = 'force-dynamic';

async function getClientData(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      integrations: {
        select: {
          integration: true,
          meta: true,
        },
      },
    },
  });
}

export default async function NewWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientData(id);

  if (!client) {
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
            New Workflow
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Create a new automation for {client.name}
          </p>
        </div>

        {/* Editor */}
        <WorkflowEditor
          clientId={client.id}
          configuredIntegrations={configuredIntegrations}
          mailerliteGroups={mailerliteGroups}
        />
      </div>
    </div>
  );
}

