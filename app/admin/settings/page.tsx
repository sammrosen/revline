'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';

interface TwoFAStatus {
  totpEnabled: boolean;
  recoveryCodesRemaining: number;
  recoveryCodesTotal: number;
  lowRecoveryCodes: boolean;
}

interface SetupData {
  secret: string;
  uri: string;
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 2FA Setup State
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  // Disable 2FA State
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // Regenerate Codes State
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const [regenerateLoading, setRegenerateLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch {
      router.push('/admin/login');
    }
  }

  async function fetchStatus() {
    try {
      const res = await fetch('/api/admin/2fa/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      } else {
        setError('Failed to load 2FA status');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function startSetup() {
    setSetupLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/2fa/setup', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start 2FA setup');
        return;
      }

      setSetupData(data);
      
      // Generate QR code from the URI
      if (data.uri) {
        const qrDataUrl = await QRCode.toDataURL(data.uri, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        setQrCodeUrl(qrDataUrl);
      }
      
      setShowSetup(true);
    } catch {
      setError('Network error');
    } finally {
      setSetupLoading(false);
    }
  }

  async function verifyAndEnable() {
    setSetupLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verificationCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }

      // Show recovery codes
      setRecoveryCodes(data.recoveryCodes);
      setShowRecoveryCodes(true);
      setShowSetup(false);
      setQrCodeUrl('');

      // Refresh status
      await fetchStatus();
    } catch {
      setError('Network error');
    } finally {
      setSetupLoading(false);
    }
  }

  async function disable2FA() {
    setDisableLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to disable 2FA');
        return;
      }

      setShowDisable(false);
      setDisablePassword('');
      await fetchStatus();
    } catch {
      setError('Network error');
    } finally {
      setDisableLoading(false);
    }
  }

  async function regenerateCodes() {
    setRegenerateLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/2fa/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: regeneratePassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to regenerate codes');
        return;
      }

      setRecoveryCodes(data.recoveryCodes);
      setShowRecoveryCodes(true);
      setShowRegenerate(false);
      setRegeneratePassword('');
      await fetchStatus();
    } catch {
      setError('Network error');
    } finally {
      setRegenerateLoading(false);
    }
  }

  function closeRecoveryCodes() {
    setRecoveryCodes([]);
    setShowRecoveryCodes(false);
  }

  function copyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-zinc-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <Link
              href="/admin/clients"
              className="text-zinc-400 hover:text-white text-sm mb-4 inline-block"
            >
              ← Back to Clients
            </Link>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
          >
            Sign Out
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Two-Factor Authentication Section */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Two-Factor Authentication</h2>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-zinc-300">
                Status:{' '}
                <span
                  className={status?.totpEnabled ? 'text-green-400' : 'text-zinc-500'}
                >
                  {status?.totpEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </p>
              {status?.totpEnabled && (
                <p className="text-sm text-zinc-400 mt-1">
                  Recovery codes: {status.recoveryCodesRemaining}/{status.recoveryCodesTotal} remaining
                  {status.lowRecoveryCodes && (
                    <span className="text-yellow-400 ml-2">⚠️ Running low</span>
                  )}
                </p>
              )}
            </div>

            {!status?.totpEnabled ? (
              <button
                onClick={startSetup}
                disabled={setupLoading}
                className="px-4 py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {setupLoading ? 'Setting up...' : 'Enable 2FA'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRegenerate(true)}
                  className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-600 transition-colors text-sm"
                >
                  Regenerate Codes
                </button>
                <button
                  onClick={() => setShowDisable(true)}
                  className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors text-sm"
                >
                  Disable 2FA
                </button>
              </div>
            )}
          </div>

          <p className="text-sm text-zinc-500">
            Two-factor authentication adds an extra layer of security to your account by requiring a code from your authenticator app when signing in.
          </p>
        </section>

        {/* 2FA Setup Modal */}
        {showSetup && setupData && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">Set Up Two-Factor Authentication</h3>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-zinc-400 mb-3">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
                  </p>

                  {/* QR Code */}
                  <div className="bg-white p-3 rounded-lg inline-block">
                    {qrCodeUrl ? (
                      <img 
                        src={qrCodeUrl} 
                        alt="2FA QR Code" 
                        width={200} 
                        height={200}
                        className="block"
                      />
                    ) : (
                      <div className="w-[200px] h-[200px] flex items-center justify-center text-black text-sm">
                        Loading QR code...
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-zinc-500 mt-3">
                    Or enter this code manually:
                  </p>
                  <code className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded mt-1 inline-block font-mono">
                    {setupData.secret}
                  </code>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">
                    Enter the 6-digit code from your app to verify:
                  </label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white text-center text-xl font-mono tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={verifyAndEnable}
                    disabled={setupLoading || verificationCode.length !== 6}
                    className="flex-1 py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                  >
                    {setupLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                  <button
                    onClick={() => {
                      setShowSetup(false);
                      setSetupData(null);
                      setQrCodeUrl('');
                      setVerificationCode('');
                    }}
                    className="px-4 py-3 text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recovery Codes Modal */}
        {showRecoveryCodes && recoveryCodes.length > 0 && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-2">Save Your Recovery Codes</h3>
              <p className="text-sm text-zinc-400 mb-4">
                These codes can be used to access your account if you lose your authenticator device.
                <span className="text-yellow-400"> Each code can only be used once.</span>
              </p>

              <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {recoveryCodes.map((code, index) => (
                    <div key={index} className="text-zinc-300">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                <p className="text-yellow-400 text-sm">
                  ⚠️ <strong>Important:</strong> Save these codes in a secure location. They will not be shown again.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyRecoveryCodes}
                  className="flex-1 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-600 transition-colors"
                >
                  Copy Codes
                </button>
                <button
                  onClick={closeRecoveryCodes}
                  className="flex-1 py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  I&apos;ve Saved These Codes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Disable 2FA Modal */}
        {showDisable && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-2 text-red-400">Disable Two-Factor Authentication</h3>
              <p className="text-sm text-zinc-400 mb-4">
                This will remove the extra security layer from your account. Enter your password to confirm.
              </p>

              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Password</label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white"
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={disable2FA}
                  disabled={disableLoading || !disablePassword}
                  className="flex-1 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {disableLoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
                <button
                  onClick={() => {
                    setShowDisable(false);
                    setDisablePassword('');
                  }}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Regenerate Codes Modal */}
        {showRegenerate && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-2">Regenerate Recovery Codes</h3>
              <p className="text-sm text-zinc-400 mb-4">
                This will invalidate all your existing recovery codes and generate new ones.
                Enter your password to confirm.
              </p>

              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Password</label>
                <input
                  type="password"
                  value={regeneratePassword}
                  onChange={(e) => setRegeneratePassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white"
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={regenerateCodes}
                  disabled={regenerateLoading || !regeneratePassword}
                  className="flex-1 py-2 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {regenerateLoading ? 'Regenerating...' : 'Regenerate Codes'}
                </button>
                <button
                  onClick={() => {
                    setShowRegenerate(false);
                    setRegeneratePassword('');
                  }}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-4 mt-8">
          <Link
            href="/admin/clients"
            className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-600 transition-colors"
          >
            Back to Clients
          </Link>
        </div>
      </div>
    </div>
  );
}

