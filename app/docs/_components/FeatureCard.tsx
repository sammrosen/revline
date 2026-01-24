import Link from 'next/link';

type ColorVariant = 'purple' | 'blue' | 'green' | 'amber' | 'cyan' | 'red';

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color?: ColorVariant;
  href?: string;
}

const colorClasses: Record<ColorVariant, { bg: string; text: string; border: string }> = {
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

export function FeatureCard({ icon: Icon, title, description, color = 'purple', href }: FeatureCardProps) {
  const colors = colorClasses[color];

  const content = (
    <div className={`p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl transition-colors ${href ? 'hover:border-zinc-700 hover:bg-zinc-900/70' : ''}`}>
      <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center mb-4`}>
        <Icon className={`w-6 h-6 ${colors.text}`} />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
