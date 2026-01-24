'use client';

import { useState } from 'react';

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({ children, language, title, showLineNumbers = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const lines = children.split('\n');

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/50 my-4">
      {(title || language) && (
        <div className="bg-zinc-800/50 px-4 py-2.5 text-xs flex justify-between items-center border-b border-zinc-800">
          <span className="text-zinc-300 font-medium">{title}</span>
          {language && (
            <span className="text-zinc-500 uppercase tracking-wider text-[10px]">{language}</span>
          )}
        </div>
      )}
      <div className="relative group">
        <pre className="p-4 text-sm text-zinc-300 overflow-x-auto">
          <code className="font-mono">
            {showLineNumbers ? (
              lines.map((line, i) => (
                <div key={i} className="flex">
                  <span className="select-none w-8 text-zinc-600 text-right pr-4">{i + 1}</span>
                  <span>{line}</span>
                </div>
              ))
            ) : (
              children
            )}
          </code>
        </pre>
        <button
          onClick={handleCopy}
          className={`
            absolute top-2 right-2 px-2.5 py-1 text-xs rounded-md transition-all
            opacity-0 group-hover:opacity-100
            ${copied
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700'
            }
          `}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
