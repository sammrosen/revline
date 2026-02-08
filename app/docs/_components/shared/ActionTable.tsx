interface Action {
  name: string;
  label: string;
  description: string;
  params?: { key: string; description: string }[];
}

interface ActionTableProps {
  actions: Action[];
  type: 'trigger' | 'action';
}

export function ActionTable({ actions, type }: ActionTableProps) {
  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div
          key={action.name}
          className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <code className="text-white bg-zinc-800 px-2 py-1 rounded text-sm">
                {action.name}
              </code>
              <span className="text-zinc-400 text-sm ml-2">{action.label}</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded ${
              type === 'trigger' 
                ? 'bg-purple-900/50 text-purple-300' 
                : 'bg-green-900/50 text-green-300'
            }`}>
              {type}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-2">{action.description}</p>
          {action.params && action.params.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-500 mb-2">Parameters:</p>
              <div className="space-y-1">
                {action.params.map((param) => (
                  <div key={param.key} className="flex items-start gap-2 text-xs">
                    <code className="text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded shrink-0">
                      {param.key}
                    </code>
                    <span className="text-zinc-500">{param.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
