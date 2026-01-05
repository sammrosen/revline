'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type LoginStep = 'password' | '2fa';

export default function AdminLoginPage() {
  const [step, setStep] = useState<LoginStep>('password');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lowRecoveryCodesWarning, setLowRecoveryCodesWarning] = useState(false);
  const router = useRouter();

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.setupRequired) {
          // Don't auto-redirect - admin needs to use setup URL with code
          setError('Admin account not configured. Contact system administrator.');
          return;
        }
        setError(data.error || 'Login failed');
        return;
      }

      // Check if 2FA is required
      if (data.requires2FA) {
        setTempToken(data.tempToken);
        setStep('2fa');
        return;
      }

      // No 2FA - login complete
      router.push('/admin/clients');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handle2FASubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken,
          code: totpCode.replace(/[-\s]/g, ''), // Remove dashes/spaces
          useRecoveryCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }

      // Check for low recovery codes warning
      if (data.lowRecoveryCodes) {
        setLowRecoveryCodesWarning(true);
        // Still proceed with login, but show warning
      }

      // Success - redirect to clients page
      router.push('/admin/clients');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function handleBackToPassword() {
    setStep('password');
    setTotpCode('');
    setTempToken('');
    setError('');
    setUseRecoveryCode(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-8 text-center">RevLine Admin</h1>

        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm text-zinc-400 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white"
                placeholder="Enter admin password"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {step === '2fa' && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold">Two-Factor Authentication</h2>
              <p className="text-sm text-zinc-400 mt-1">
                {useRecoveryCode
                  ? 'Enter one of your recovery codes'
                  : 'Enter the 6-digit code from your authenticator app'}
              </p>
            </div>

            <form onSubmit={handle2FASubmit} className="space-y-4">
              <div>
                <label htmlFor="totp" className="block text-sm text-zinc-400 mb-2">
                  {useRecoveryCode ? 'Recovery Code' : 'Verification Code'}
                </label>
                <input
                  id="totp"
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white text-center text-xl font-mono tracking-widest"
                  placeholder={useRecoveryCode ? 'XXXX-XXXX' : '000000'}
                  maxLength={useRecoveryCode ? 9 : 6}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>

              {lowRecoveryCodesWarning && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ You have less than 3 recovery codes remaining. Consider regenerating them in Settings.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>

            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode(!useRecoveryCode);
                  setTotpCode('');
                  setError('');
                }}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                {useRecoveryCode
                  ? '← Use authenticator app instead'
                  : "Can't access your authenticator? Use a recovery code"}
              </button>
              
              <button
                type="button"
                onClick={handleBackToPassword}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ← Back to password
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
