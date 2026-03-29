'use client';

import { useState } from 'react';
import {
  FileCode,
  X,
  Zap,
  Play,
  Globe,
  FlaskConical,
  KeyRound,
} from 'lucide-react';
import type { IntegrationReference } from '@/app/_lib/types';
import { getIntegrationStyle } from '@/app/_lib/workflow/integration-config';
import type { LucideIcon } from 'lucide-react';

interface IntegrationReferenceDialogProps {
  reference: IntegrationReference;
}

export function IntegrationReferenceDialog({ reference }: IntegrationReferenceDialogProps) {
  const [open, setOpen] = useState(false);
  const style = getIntegrationStyle(reference.adapterId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
        title="API Reference"
      >
        <FileCode className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-zinc-900 border border-zinc-800 rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                {style.logo ? (
                  <img
                    src={style.logo}
                    alt={reference.integration}
                    className="w-5 h-5 object-contain"
                  />
                ) : (
                  <style.icon className={`w-5 h-5 ${style.textClass}`} />
                )}
                <span className={`font-bold tracking-tight ${style.textClass}`}>
                  {reference.integration}
                </span>
                <span className="text-zinc-500 text-xs font-medium">Reference</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Requires */}
              {(reference.requires.secrets.length > 0 ||
                reference.requires.metaKeys.length > 0) && (
                <Section icon={KeyRound} label="Requires">
                  <div className="flex flex-wrap gap-1.5">
                    {reference.requires.secrets.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-300 rounded font-mono"
                      >
                        {s}
                      </span>
                    ))}
                    {reference.requires.metaKeys.map((k) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded font-mono"
                      >
                        meta.{k}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Triggers */}
              <Section icon={Zap} label="Triggers" count={reference.triggers.length}>
                {reference.triggers.length === 0 ? (
                  <p className="text-xs text-zinc-600">No triggers</p>
                ) : (
                  <div className="space-y-1.5">
                    {reference.triggers.map((t) => (
                      <div
                        key={t.operation}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="text-xs font-mono text-zinc-400 shrink-0">
                            {t.operation}
                          </code>
                          <span className="text-xs text-zinc-500 truncate">{t.label}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {t.hasTestFields && <Badge color="green">test</Badge>}
                          {t.planned && <Badge color="amber">planned</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Actions */}
              <Section icon={Play} label="Actions" count={reference.actions.length}>
                {reference.actions.length === 0 ? (
                  <p className="text-xs text-zinc-600">No actions</p>
                ) : (
                  <div className="space-y-1.5">
                    {reference.actions.map((a) => (
                      <div
                        key={a.operation}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="text-xs font-mono text-zinc-400 shrink-0">
                            {a.operation}
                          </code>
                          <span className="text-xs text-zinc-500 truncate">{a.label}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {a.hasTestFields && <Badge color="green">test</Badge>}
                          {a.stub && <Badge color="amber">stub</Badge>}
                          {!a.implemented && !a.stub && <Badge color="red">no exec</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Routes */}
              <Section icon={Globe} label="Routes" count={reference.routes.length}>
                {reference.routes.length === 0 ? (
                  <p className="text-xs text-zinc-600">No unique routes</p>
                ) : (
                  <div className="space-y-2">
                    {reference.routes.map((r, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <MethodBadge method={r.method} />
                        <div className="min-w-0">
                          <code className="text-xs font-mono text-zinc-400 break-all">
                            {r.path}
                          </code>
                          <p className="text-xs text-zinc-600">{r.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Test Suite */}
              <Section icon={FlaskConical} label="Test Suite">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span>
                    {reference.testSuite.triggerTests} trigger test
                    {reference.testSuite.triggerTests !== 1 ? 's' : ''}
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span>
                    {reference.testSuite.actionTests} action test
                    {reference.testSuite.actionTests !== 1 ? 's' : ''}
                  </span>
                  {reference.testSuite.knownEndpoints > 0 && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <span>
                        {reference.testSuite.knownEndpoints} endpoint
                        {reference.testSuite.knownEndpoints !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                  {reference.testSuite.scenarios.length > 0 && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <span>
                        {reference.testSuite.scenarios.length} scenario
                        {reference.testSuite.scenarios.length !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>
                {reference.testSuite.scenarios.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {reference.testSuite.scenarios.map((s) => (
                      <p
                        key={s}
                        className="text-xs text-zinc-600 pl-2 border-l border-zinc-800"
                      >
                        {s}
                      </p>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function Section({
  icon: Icon,
  label,
  count,
  children,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </span>
        {count !== undefined && (
          <span className="text-[10px] text-zinc-600">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Badge({
  color,
  children,
}: {
  color: 'green' | 'amber' | 'red';
  children: React.ReactNode;
}) {
  const colors = {
    green: 'bg-green-500/15 text-green-500',
    amber: 'bg-amber-500/15 text-amber-500',
    red: 'bg-red-500/15 text-red-500',
  };
  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-500/15 text-emerald-400',
    POST: 'bg-blue-500/15 text-blue-400',
    PATCH: 'bg-amber-500/15 text-amber-400',
    DELETE: 'bg-red-500/15 text-red-400',
  };
  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-bold tracking-wider rounded shrink-0 ${colors[method] ?? 'bg-zinc-800 text-zinc-400'}`}
    >
      {method}
    </span>
  );
}
