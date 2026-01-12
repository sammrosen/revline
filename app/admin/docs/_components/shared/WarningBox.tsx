interface WarningBoxProps {
  children: React.ReactNode;
  title?: string;
}

export function WarningBox({ children, title = 'Warning' }: WarningBoxProps) {
  return (
    <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-amber-400 shrink-0">⚠️</span>
        <div>
          {title !== 'Warning' && (
            <p className="text-sm font-medium text-amber-400 mb-1">{title}</p>
          )}
          <div className="text-sm text-amber-200/80">{children}</div>
        </div>
      </div>
    </div>
  );
}
