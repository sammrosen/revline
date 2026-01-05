'use client';

import { useState } from 'react';

interface TestNotificationButtonProps {
  clientId: string;
}

export function TestNotificationButton({ clientId }: TestNotificationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function sendTestNotification() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/test-pushover`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ success: true, message: 'Notification sent!' });
      } else {
        setResult({
          success: false,
          message: data.error || data.details || 'Failed to send notification',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error';
      setResult({ success: false, message });
    } finally {
      setLoading(false);
      // Clear result after 4 seconds
      setTimeout(() => setResult(null), 4000);
    }
  }

  return (
    <>
      <button
        onClick={sendTestNotification}
        disabled={loading}
        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
          loading
            ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            : 'bg-violet-600 hover:bg-violet-700 text-white'
        }`}
        title="Send a test push notification to your phone"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
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
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Sending...
          </span>
        ) : (
          'Test Notification'
        )}
      </button>

      {result && (
        <div
          className={`fixed top-4 right-4 rounded-lg p-3 text-sm z-50 max-w-md border ${
            result.success
              ? 'bg-green-500/10 border-green-500/50 text-green-400'
              : 'bg-red-500/10 border-red-500/50 text-red-400'
          }`}
        >
          {result.message}
        </div>
      )}
    </>
  );
}

