'use client';

import Link from 'next/link';
import { useDocTabs, type TabId } from './_components/DocTabs';
import { DocsLayout } from './_components/DocsLayout';
import { TabNavigator } from './_components/shared';
import {
  OverviewTab,
  PlatformTab,
  OrganizationsTab,
  FormsTab,
  WorkflowsTab,
  MailerLiteTab,
  StripeTab,
  CalendlyTab,
  ManyChatTab,
  AbcIgniteTab,
  ResendTab,
  TestingTab,
} from './_components/tabs';

export default function DocsPage() {
  const { activeTab, setActiveTab } = useDocTabs('overview');

  return (
    <DocsLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <p className="text-zinc-400 text-sm mb-6">
          Reference guide for workspace setup, integrations, and platform architecture
        </p>

        <div className="min-h-[60vh]">
          <TabContent activeTab={activeTab} />
          <TabNavigator activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-800">
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href="/workspaces/new"
              className="px-4 py-2 bg-white text-black rounded font-medium hover:bg-zinc-200 transition-colors"
            >
              + New Workspace
            </Link>
            <Link
              href="/workspaces"
              className="px-4 py-2 border border-zinc-700 text-white rounded hover:border-zinc-600 transition-colors"
            >
              View Workspaces
            </Link>
          </div>
        </div>
      </div>
    </DocsLayout>
  );
}

function TabContent({ activeTab }: { activeTab: TabId }) {
  switch (activeTab) {
    case 'overview':
      return <OverviewTab />;
    case 'platform':
      return <PlatformTab />;
    case 'organizations':
      return <OrganizationsTab />;
    case 'forms':
      return <FormsTab />;
    case 'workflows':
      return <WorkflowsTab />;
    case 'mailerlite':
      return <MailerLiteTab />;
    case 'stripe':
      return <StripeTab />;
    case 'calendly':
      return <CalendlyTab />;
    case 'manychat':
      return <ManyChatTab />;
    case 'abc-ignite':
      return <AbcIgniteTab />;
    case 'resend':
      return <ResendTab />;
    case 'testing':
      return <TestingTab />;
    default:
      return <OverviewTab />;
  }
}
