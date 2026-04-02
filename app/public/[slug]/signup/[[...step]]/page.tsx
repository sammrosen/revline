/**
 * Public Signup Page
 * 
 * /public/[slug]/signup
 * /public/[slug]/signup/step/[n]
 * 
 * Multi-step membership signup flow for any workspace.
 * Uses workspace slug for lookup and optional step parameter for bookmarkable URLs.
 * 
 * Configuration:
 * - Loads branding, plans, copy, and policies from workspace's Revline signup config
 * - Falls back to global defaults if not configured
 */

import { notFound } from 'next/navigation';
import { WorkspaceStatus } from '@prisma/client';
import { WorkspaceConfigService } from '@/app/_lib/config';
import { getWorkspaceBySlug } from '@/app/_lib/public-page';
import { SignupClient } from '../client';

interface SignupPageProps {
  params: Promise<{
    slug: string;
    step?: string[];
  }>;
}

export default async function PublicSignupPage({ params }: SignupPageProps) {
  const { slug, step } = await params;
  
  let initialStep = 1;
  if (step && step.length === 2 && step[0] === 'step') {
    const parsed = parseInt(step[1], 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) {
      initialStep = parsed;
    }
  }
  
  const workspace = await getWorkspaceBySlug(slug);

  if (!workspace) {
    notFound();
  }

  if (workspace.status !== WorkspaceStatus.ACTIVE) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Signup Unavailable</h1>
          <p className="text-gray-600">Online signup is temporarily unavailable. Please contact us directly.</p>
        </div>
      </div>
    );
  }

  const config = await WorkspaceConfigService.resolveForSignup(workspace.id);

  if (!config.enabled) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Signup Not Available</h1>
          <p className="text-gray-600">Online membership signup is not currently available. Please contact the front desk.</p>
        </div>
      </div>
    );
  }

  if (config.plans.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Configuration Error</h1>
          <p className="text-gray-600">No membership plans are configured. Please contact the front desk.</p>
        </div>
      </div>
    );
  }

  return (
    <SignupClient
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      initialStep={initialStep}
      branding={config.branding}
      theme={config.theme}
      headerStyle={config.headerStyle}
      typography={config.typography}
      club={config.club}
      plans={config.plans}
      copy={config.copy}
      policies={config.policies}
      logoSize={config.logoSize}
      features={config.features}
      signupFeatures={config.signupFeatures}
    />
  );
}

export async function generateMetadata({ params }: SignupPageProps) {
  const { slug } = await params;
  
  const workspace = await getWorkspaceBySlug(slug);

  if (!workspace) {
    return { title: 'Signup Not Found' };
  }

  if (workspace.status !== WorkspaceStatus.ACTIVE) {
    return {
      title: `Join ${workspace.name} - Membership Signup`,
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `Join ${workspace.name} - Membership Signup`,
    description: `Become a member at ${workspace.name}. Easy online signup with flexible membership options.`,
  };
}
