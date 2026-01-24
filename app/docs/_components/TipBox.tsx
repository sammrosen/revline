interface TipBoxProps {
  children: React.ReactNode;
  title?: string;
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function TipBox({ children, title = 'Tip' }: TipBoxProps) {
  return (
    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl my-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
          <InfoIcon className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div>
          {title !== 'Tip' && (
            <p className="text-sm font-medium text-blue-400 mb-1">{title}</p>
          )}
          <div className="text-sm text-blue-200/80 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
