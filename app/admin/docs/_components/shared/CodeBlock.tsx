'use client';

import { useState } from 'react';

interface CodeBlockProps {
  children: string;
  language?: string;
  title?: string;
}

export function CodeBlock({ children, language, title }: CodeBlockProps) {
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

  return (
    <div className="rounded-lg overflow-hidden border border-zinc-800">
      {title && (
        <div className="bg-zinc-800 px-4 py-2 text-xs text-zinc-400 flex justify-between items-center">
          <span>{title}</span>
          {language && <span className="text-zinc-500">{language}</span>}
        </div>
      )}
      <div className="relative">
        <pre className="bg-zinc-950 p-4 text-sm text-zinc-300 overflow-x-auto scrollbar-hide">
          <code>{children}</code>
        </pre>
        <button
          onClick={handleCopy}
          className={`absolute top-2 right-2 px-2 py-1 text-xs rounded transition-colors ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
          }`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
