interface Secret {
  name: string;
  placeholder: string;
  description: string;
  required?: boolean;
}

interface SecretTableProps {
  secrets: Secret[];
}

export function SecretTable({ secrets }: SecretTableProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800">
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium">Format</th>
            <th className="pb-2 font-medium">Required</th>
          </tr>
        </thead>
        <tbody className="text-zinc-300">
          {secrets.map((secret) => (
            <tr key={secret.name} className="border-b border-zinc-800/50">
              <td className="py-3">
                <code className="text-white bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
                  {secret.name}
                </code>
              </td>
              <td className="py-3">
                <code className="text-zinc-400 text-xs">{secret.placeholder}</code>
                <p className="text-xs text-zinc-500 mt-1">{secret.description}</p>
              </td>
              <td className="py-3">
                {secret.required !== false ? (
                  <span className="text-green-400 text-xs">Yes</span>
                ) : (
                  <span className="text-zinc-500 text-xs">Optional</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
