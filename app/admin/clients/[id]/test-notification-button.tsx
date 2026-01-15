'use client';

import { useState, useEffect } from 'react';

/**
 * Alert test scenarios - must match backend
 */
const ALERT_SCENARIOS = [
  {
    key: 'basic',
    label: 'Basic Test',
    description: 'Simple notification to verify Pushover is working',
    type: 'basic',
    icon: '✅',
  },
  {
    key: 'webhook_stripe',
    label: 'Stripe Webhook Failed',
    description: 'Simulates a Stripe webhook signature verification failure',
    type: 'critical',
    icon: '🔴',
  },
  {
    key: 'webhook_calendly',
    label: 'Calendly Webhook Failed',
    description: 'Simulates a Calendly webhook processing failure',
    type: 'critical',
    icon: '🔴',
  },
  {
    key: 'workflow_failed',
    label: 'Workflow Failed',
    description: 'Simulates a workflow execution failure',
    type: 'critical',
    icon: '🔴',
  },
  {
    key: 'integration_error',
    label: 'Integration Error',
    description: 'Simulates an external API integration failure (e.g., MailerLite)',
    type: 'critical',
    icon: '🔴',
  },
  {
    key: 'db_unreachable',
    label: 'Database Unreachable',
    description: 'Simulates a database connectivity failure',
    type: 'critical',
    icon: '🔴',
  },
  {
    key: 'rate_limit',
    label: 'Rate Limit Warning',
    description: 'Simulates hitting rate limits on an external API',
    type: 'warning',
    icon: '🟡',
  },
  {
    key: 'health_degraded',
    label: 'Health Check Degraded',
    description: 'Simulates a degraded health check status',
    type: 'warning',
    icon: '🟡',
  },
] as const;

type ScenarioKey = (typeof ALERT_SCENARIOS)[number]['key'];

interface RateLimitStatus {
  remaining: number;
  suppressed: number;
}

interface TestAlertDialogProps {
  clientId: string;
  onClose: () => void;
}

function TestAlertDialog({ clientId, onClose }: TestAlertDialogProps) {
  const [loading, setLoading] = useState<ScenarioKey | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; scenario?: string } | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);

  // Fetch rate limit status on mount
  useEffect(() => {
    fetch(`/api/v1/admin/clients/${clientId}/test-alert`)
      .then((res) => res.json())
      .then((data) => {
        if (data.rateLimitStatus) {
          setRateLimitStatus(data.rateLimitStatus);
        }
      })
      .catch(() => {
        // Ignore - status will just not be shown
      });
  }, [clientId]);

  async function fireTestAlert(scenario: ScenarioKey) {
    setLoading(scenario);
    setResult(null);

    try {
      const res = await fetch(`/api/v1/admin/clients/${clientId}/test-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          success: true,
          message: 'Alert sent! Check your phone.',
          scenario: data.scenario,
        });
        // Refresh rate limit status
        const statusRes = await fetch(`/api/v1/admin/clients/${clientId}/test-alert`);
        const statusData = await statusRes.json();
        if (statusData.rateLimitStatus) {
          setRateLimitStatus(statusData.rateLimitStatus);
        }
      } else {
        setResult({
          success: false,
          message: data.error || data.details || 'Failed to send alert',
          scenario: data.scenario,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setResult({ success: false, message });
    } finally {
      setLoading(null);
    }
  }

  const criticalScenarios = ALERT_SCENARIOS.filter((s) => s.type === 'critical');
  const warningScenarios = ALERT_SCENARIOS.filter((s) => s.type === 'warning');
  const basicScenario = ALERT_SCENARIOS.find((s) => s.type === 'basic');

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border-0 sm:border sm:border-zinc-800 rounded-none sm:rounded-lg w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Test Alerts</h2>
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded font-medium">
              PUSHOVER
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <p className="text-sm text-zinc-400">
            Fire test alerts to see exactly what real system notifications look like on your phone.
            Each scenario uses the actual AlertService code path.
          </p>

          {/* Rate Limit Status */}
          {rateLimitStatus && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-950 rounded px-3 py-2">
              <span>Rate limit:</span>
              <span className={rateLimitStatus.remaining > 3 ? 'text-green-400' : 'text-amber-400'}>
                {rateLimitStatus.remaining}/10 remaining
              </span>
              {rateLimitStatus.suppressed > 0 && (
                <span className="text-red-400">({rateLimitStatus.suppressed} suppressed)</span>
              )}
            </div>
          )}

          {/* Result Banner */}
          {result && (
            <div
              className={`rounded-lg p-4 text-sm border ${
                result.success
                  ? 'bg-green-500/10 border-green-500/50 text-green-400'
                  : 'bg-red-500/10 border-red-500/50 text-red-400'
              }`}
            >
              <div className="font-medium mb-1">
                {result.success ? '✓ Alert Sent' : '✗ Failed'}
              </div>
              <div className="text-xs opacity-80">
                {result.scenario && <span className="font-mono">{result.scenario}: </span>}
                {result.message}
              </div>
            </div>
          )}

          {/* Basic Test */}
          {basicScenario && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                Connectivity Test
              </h3>
              <button
                onClick={() => fireTestAlert(basicScenario.key)}
                disabled={loading !== null}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  loading === basicScenario.key
                    ? 'bg-zinc-800 border-zinc-700 cursor-wait'
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{basicScenario.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm flex items-center gap-2">
                      {basicScenario.label}
                      {loading === basicScenario.key && (
                        <svg
                          className="animate-spin h-3 w-3 text-zinc-400"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">{basicScenario.description}</div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Critical Alerts */}
          <div>
            <h3 className="text-xs font-semibold text-red-400/80 uppercase tracking-wide mb-3">
              Critical Alerts
            </h3>
            <div className="space-y-2">
              {criticalScenarios.map((scenario) => (
                <button
                  key={scenario.key}
                  onClick={() => fireTestAlert(scenario.key)}
                  disabled={loading !== null}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    loading === scenario.key
                      ? 'bg-zinc-800 border-zinc-700 cursor-wait'
                      : 'bg-zinc-950 border-zinc-800 hover:border-red-900/50 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm">{scenario.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm flex items-center gap-2">
                        {scenario.label}
                        {loading === scenario.key && (
                          <svg
                            className="animate-spin h-3 w-3 text-zinc-400"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{scenario.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Warning Alerts */}
          <div>
            <h3 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wide mb-3">
              Warning Alerts
            </h3>
            <div className="space-y-2">
              {warningScenarios.map((scenario) => (
                <button
                  key={scenario.key}
                  onClick={() => fireTestAlert(scenario.key)}
                  disabled={loading !== null}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    loading === scenario.key
                      ? 'bg-zinc-800 border-zinc-700 cursor-wait'
                      : 'bg-zinc-950 border-zinc-800 hover:border-amber-900/50 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm">{scenario.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm flex items-center gap-2">
                        {scenario.label}
                        {loading === scenario.key && (
                          <svg
                            className="animate-spin h-3 w-3 text-zinc-400"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">{scenario.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="text-xs text-zinc-600 bg-zinc-950 rounded p-3">
            <strong className="text-zinc-500">Note:</strong> All test alerts include a{' '}
            <code className="text-zinc-400">[TEST]</code> prefix in the message body.
            Rate limiting applies to prevent notification spam (max 10/minute).
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface TestNotificationButtonProps {
  clientId: string;
  isDropdownItem?: boolean;
}

export function TestNotificationButton({
  clientId,
  isDropdownItem = false,
}: TestNotificationButtonProps) {
  const [showModal, setShowModal] = useState(false);

  if (isDropdownItem) {
    return (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(true);
          }}
          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white"
        >
          Test Notification
        </button>

        {showModal && (
          <TestAlertDialog clientId={clientId} onClose={() => setShowModal(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm font-medium transition-colors"
        title="Test push notifications and alerts"
      >
        Test Notification
      </button>

      {showModal && (
        <TestAlertDialog clientId={clientId} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
