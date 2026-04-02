/**
 * Public Landing Page
 * 
 * /public/[slug]/landing
 * 
 * Configurable landing page with hero, services, images, contact capture,
 * and optional webchat widget. Uses workspace branding and copy config
 * with the same 3-layer merge pattern as booking/signup.
 */

import { notFound } from 'next/navigation';
import { WorkspaceStatus } from '@prisma/client';
import { WorkspaceConfigService } from '@/app/_lib/config';
import { getWorkspaceBySlug } from '@/app/_lib/public-page';
import { LandingClient } from './client';

interface LandingPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PublicLandingPage({ params }: LandingPageProps) {
  const { slug } = await params;

  const workspace = await getWorkspaceBySlug(slug);

  if (!workspace) {
    notFound();
  }

  if (workspace.status !== WorkspaceStatus.ACTIVE) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Page Unavailable</h1>
          <p className="text-gray-600">This page is temporarily unavailable. Please check back later.</p>
        </div>
      </div>
    );
  }

  const config = await WorkspaceConfigService.resolveForLanding(workspace.id);

  return (
    <LandingClient
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      branding={config.branding}
      theme={config.theme}
      headerStyle={config.headerStyle}
      typography={config.typography}
      copy={config.copy}
      features={config.features}
      logoSize={config.logoSize}
      webchat={config.webchat}
    />
  );
}

export async function generateMetadata({ params }: LandingPageProps) {
  const { slug } = await params;

  const workspace = await getWorkspaceBySlug(slug);

  if (!workspace) {
    return { title: 'Page Not Found' };
  }

  if (workspace.status !== WorkspaceStatus.ACTIVE) {
    return {
      title: workspace.name,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: workspace.name,
    description: `Welcome to ${workspace.name}`,
  };
}
