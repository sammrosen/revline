interface Step {
  title: string;
  description: string;
}

interface StepListProps {
  steps: Step[];
}

export function StepList({ steps }: StepListProps) {
  return (
    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl my-6">
      <ol className="space-y-6">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-4">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 font-medium shrink-0 text-sm">
              {i + 1}
            </span>
            <div className="pt-0.5">
              <p className="font-medium text-white">{step.title}</p>
              <p className="text-sm text-zinc-400 mt-1">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
