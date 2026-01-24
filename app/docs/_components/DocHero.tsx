interface DocHeroProps {
  title: string;
  titleGradient?: string;
  description: string;
  badge?: string;
}

export function DocHero({ title, titleGradient, description, badge }: DocHeroProps) {
  // Split title if gradient portion is provided
  const hasGradient = titleGradient && title.includes(titleGradient);
  
  return (
    <div className="mb-12">
      {badge && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-800/80 border border-zinc-700/50 rounded-full text-xs uppercase tracking-wider text-zinc-400 mb-4">
          {badge}
        </div>
      )}
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
        {hasGradient ? (
          <>
            {title.split(titleGradient)[0]}
            <span className="bg-gradient-to-r from-purple-400 via-violet-400 to-purple-500 bg-clip-text text-transparent">
              {titleGradient}
            </span>
            {title.split(titleGradient)[1]}
          </>
        ) : (
          title
        )}
      </h1>
      <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl">
        {description}
      </p>
    </div>
  );
}
