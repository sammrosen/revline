'use client';

import Link from 'next/link';
import { DocTabs, useDocTabs, type TabId } from './_components/DocTabs';
import {
  OverviewTab,
  WorkflowsTab,
  MailerLiteTab,
  StripeTab,
  CalendlyTab,
  ManyChatTab,
  AbcIgniteTab,
  TestingTab,
} from './_components/tabs';

export default function DocsPage() {
  const { activeTab, setActiveTab } = useDocTabs('overview');

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link
              href="/admin/clients"
              className="text-zinc-400 hover:text-white text-sm mb-2 inline-block"
            >
              ← Back to Admin
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold">RevLine Docs</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Reference guide for client setup and integrations
            </p>
          </div>
        </div>

        {/* Tabs */}
        <DocTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <div className="min-h-[60vh]">
          <TabContent activeTab={activeTab} />
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-zinc-800">
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href="/admin/clients/new"
              className="px-4 py-2 bg-white text-black rounded font-medium hover:bg-zinc-200 transition-colors"
            >
              + New Client
            </Link>
            <Link
              href="/admin/clients"
              className="px-4 py-2 border border-zinc-700 text-white rounded hover:border-zinc-600 transition-colors"
            >
              View Clients
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabContent({ activeTab }: { activeTab: TabId }) {
  switch (activeTab) {
    case 'overview':
      return <OverviewTab />;
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
    case 'testing':
      return <TestingTab />;
    default:
      return <OverviewTab />;
  }
}
