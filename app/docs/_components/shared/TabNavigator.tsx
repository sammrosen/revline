import type { TabId } from '../DocTabs';

const TAB_ORDER: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'platform', label: 'Platform' },
  { id: 'organizations', label: 'Organizations' },
  { id: 'forms', label: 'Forms & Sites' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'mailerlite', label: 'MailerLite' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'calendly', label: 'Calendly' },
  { id: 'manychat', label: 'ManyChat' },
  { id: 'abc-ignite', label: 'ABC Ignite' },
  { id: 'resend', label: 'Resend' },
  { id: 'testing', label: 'Testing' },
];

interface TabNavigatorProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabNavigator({ activeTab, onTabChange }: TabNavigatorProps) {
  const currentIndex = TAB_ORDER.findIndex((t) => t.id === activeTab);
  const prev = currentIndex > 0 ? TAB_ORDER[currentIndex - 1] : null;
  const next = currentIndex < TAB_ORDER.length - 1 ? TAB_ORDER[currentIndex + 1] : null;

  return (
    <div className="flex items-center justify-between mt-12 pt-6 border-t border-zinc-800">
      {prev ? (
        <button
          onClick={() => {
            window.scrollTo({ top: 0 });
            onTabChange(prev.id);
          }}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors group"
        >
          <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">&larr;</span>
          <div className="text-left">
            <p className="text-xs text-zinc-600">Previous</p>
            <p className="font-medium">{prev.label}</p>
          </div>
        </button>
      ) : (
        <div />
      )}
      {next ? (
        <button
          onClick={() => {
            window.scrollTo({ top: 0 });
            onTabChange(next.id);
          }}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors group"
        >
          <div className="text-right">
            <p className="text-xs text-zinc-600">Next</p>
            <p className="font-medium">{next.label}</p>
          </div>
          <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors">&rarr;</span>
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}
