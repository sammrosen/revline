interface TipBoxProps {
  children: React.ReactNode;
  title?: string;
}

export function TipBox({ children, title = 'Tip' }: TipBoxProps) {
  return (
    <div className="p-4 bg-blue-950/30 border border-blue-900/50 rounded-lg">
      <div className="flex items-start gap-2">
        <span className="text-blue-400 shrink-0">💡</span>
        <div>
          {title !== 'Tip' && (
            <p className="text-sm font-medium text-blue-400 mb-1">{title}</p>
          )}
          <div className="text-sm text-blue-200/80">{children}</div>
        </div>
      </div>
    </div>
  );
}
