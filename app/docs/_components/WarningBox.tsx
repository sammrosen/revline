interface WarningBoxProps {
  children: React.ReactNode;
  title?: string;
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function WarningBox({ children, title = 'Warning' }: WarningBoxProps) {
  return (
    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl my-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
          <AlertIcon className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          {title !== 'Warning' && (
            <p className="text-sm font-medium text-amber-400 mb-1">{title}</p>
          )}
          <div className="text-sm text-amber-200/80 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
