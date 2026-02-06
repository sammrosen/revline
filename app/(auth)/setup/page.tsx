'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PASSWORD_REQUIREMENTS = [
  { label: 'At least 12 characters', test: (p: string) => p.length >= 12 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

export default function AdminSetupPage() {
  const [setupCode, setSetupCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [requiresSetupCode, setRequiresSetupCode] = useState(false);
  const router = useRouter();

  // Check if setup is available
  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await fetch('/api/v1/auth/setup');
        if (res.ok) {
          const data = await res.json();
          setSetupRequired(true);
          setRequiresSetupCode(data.requiresSetupCode || false);
        } else if (res.status === 404) {
          // Admin already exists
          setError('Admin account already exists.');
        } else {
          setError('Setup check failed');
        }
      } catch {
        setError('Failed to check setup status');
      } finally {
        setCheckingSetup(false);
      }
    }
    checkSetup();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (requiresSetupCode && !setupCode.trim()) {
      setError('Setup code is required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const allRequirementsMet = PASSWORD_REQUIREMENTS.every(req => req.test(password));
    if (!allRequirementsMet) {
      setError('Please meet all password requirements');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          password, 
          confirmPassword,
          setupCode: setupCode.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Setup failed');
        return;
      }

      // Success - redirect to admin dashboard
      router.push('/workspaces');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-zinc-400">Checking setup status...</div>
      </div>
    );
  }

  if (!setupRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Setup Unavailable</h1>
          {error && (
            <p className="text-zinc-400 mb-6">{error}</p>
          )}
          <Link
            href="/login"
            className="text-zinc-400 hover:text-white transition-colors text-sm"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">RevLine Setup</h1>
          <p className="text-zinc-400">Create your admin account to get started</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Setup Code Field (only shown if required) */}
            {requiresSetupCode && (
              <div>
                <label htmlFor="setupCode" className="block text-sm text-zinc-400 mb-2">
                  Setup Code
                </label>
                <input
                  id="setupCode"
                  type="text"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white"
                  placeholder="Enter setup code"
                  required
                  autoFocus
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Contact your administrator for the setup code
                </p>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm text-zinc-400 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white"
                placeholder="Create a strong password"
                required
                autoFocus={!requiresSetupCode}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-zinc-400 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 text-white"
                placeholder="Confirm your password"
                required
              />
            </div>

            {/* Password requirements checklist */}
            <div className="bg-zinc-950 rounded-lg p-4">
              <p className="text-sm text-zinc-400 mb-3">Password requirements:</p>
              <ul className="space-y-2">
                {PASSWORD_REQUIREMENTS.map((req, index) => {
                  const met = req.test(password);
                  return (
                    <li
                      key={index}
                      className={`flex items-center gap-2 text-sm ${
                        met ? 'text-green-400' : 'text-zinc-500'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                        met ? 'bg-green-500/20' : 'bg-zinc-800'
                      }`}>
                        {met ? '✓' : ''}
                      </span>
                      {req.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Password match indicator */}
            {confirmPassword && (
              <div className={`text-sm ${password === confirmPassword ? 'text-green-400' : 'text-red-400'}`}>
                {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
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
              {loading ? 'Creating Account...' : 'Create Admin Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-500 mt-6">
          This page is only available during initial setup.
          <br />
          Once created, your admin account cannot be reset from here.
        </p>
      </div>
    </div>
  );
}
