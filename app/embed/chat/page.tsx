/**
 * Embed Chat Page
 *
 * /embed/chat?config=webchat-config-uuid  (preferred, loads from WebchatConfig)
 * /embed/chat?workspace=slug&agent=uuid&color=%232563eb&name=Chat&collectEmail=true  (legacy)
 *
 * Rendered inside an iframe by the webchat-loader.js script on external pages.
 */

import { prisma } from '@/app/_lib/db';
import { WebchatEmbed } from '@/app/_components/WebchatEmbed';

interface EmbedChatPageProps {
  searchParams: Promise<{
    config?: string;
    workspace?: string;
    agent?: string;
    color?: string;
    name?: string;
    collectEmail?: string;
  }>;
}

export default async function EmbedChatPage({ searchParams }: EmbedChatPageProps) {
  const params = await searchParams;

  if (params.config) {
    const config = await prisma.webchatConfig.findUnique({
      where: { id: params.config },
      include: {
        workspace: { select: { slug: true } },
        agent: { select: { id: true, active: true } },
      },
    });

    if (!config || !config.active || !config.agent.active) {
      return (
        <div className="w-full h-screen flex items-center justify-center bg-white">
          <p className="text-sm text-gray-400">Chat unavailable</p>
        </div>
      );
    }

    return (
      <div className="w-full h-screen">
        <WebchatEmbed
          workspaceSlug={config.workspace.slug}
          agentId={config.agent.id}
          configId={config.id}
          brandColor={config.brandColor}
          agentName={config.chatName}
          collectEmail={config.collectEmail}
          greeting={config.greeting}
        />
      </div>
    );
  }

  const workspace = params.workspace;
  const agent = params.agent;

  if (!workspace || !agent) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-gray-400">Chat unavailable</p>
      </div>
    );
  }

  const color = params.color || '#2563eb';
  const name = params.name || 'Chat';
  const collectEmail = params.collectEmail === 'true';

  return (
    <div className="w-full h-screen">
      <WebchatEmbed
        workspaceSlug={workspace}
        agentId={agent}
        brandColor={color}
        agentName={name}
        collectEmail={collectEmail}
      />
    </div>
  );
}
