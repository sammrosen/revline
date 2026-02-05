'use client';

import { useState } from 'react';

/**
 * Workspace Settings Component
 * 
 * Allows editing workspace-level settings:
 * - Timezone
 * - Custom Domain (with DNS verification)
 */

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'UTC', label: 'UTC' },
];

interface DomainConfig {
  customDomain: string | null;
  domainVerifyToken: string | null;
  domainVerified: boolean;
  domainVerifiedAt: string | null;
}

interface WorkspaceSettingsProps {
  workspaceId: string;
  currentTimezone: string;
  domainConfig?: DomainConfig;
}

export function WorkspaceSettings({ 
  workspaceId, 
  currentTimezone,
  domainConfig,
}: WorkspaceSettingsProps) {
  // Timezone state
  const [timezone, setTimezone] = useState(currentTimezone);
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [timezoneSaved, setTimezoneSaved] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);

  // Domain state
  const [domain, setDomain] = useState(domainConfig?.customDomain || '');
  const [domainToken, setDomainToken] = useState(domainConfig?.domainVerifyToken || '');
  const [domainVerified, setDomainVerified] = useState(domainConfig?.domainVerified || false);
  const [savingDomain, setSavingDomain] = useState(false);
  const [verifyingDomain, setVerifyingDomain] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null);

  // =========================================================================
  // TIMEZONE HANDLERS
  // =========================================================================

  const handleSaveTimezone = async () => {
    setSavingTimezone(true);
    setTimezoneError(null);
    setTimezoneSaved(false);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setTimezoneSaved(true);
      setTimeout(() => setTimezoneSaved(false), 3000);
    } catch (err) {
      setTimezoneError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingTimezone(false);
    }
  };

  // =========================================================================
  // DOMAIN HANDLERS
  // =========================================================================

  const handleSetupDomain = async () => {
    if (!domain.trim()) {
      setDomainError('Please enter a domain');
      return;
    }

    setSavingDomain(true);
    setDomainError(null);
    setDomainSuccess(null);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: domain.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup domain');
      }

      setDomainToken(data.token);
      setDomainVerified(false);
      setDomainSuccess('Domain configured. Add the TXT record below and click Verify.');
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Failed to setup domain');
    } finally {
      setSavingDomain(false);
    }
  };

  const handleVerifyDomain = async () => {
    setVerifyingDomain(true);
    setDomainError(null);
    setDomainSuccess(null);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/domain/verify`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      if (data.verified) {
        setDomainVerified(true);
        setDomainSuccess('Domain verified successfully!');
      } else {
        setDomainError(data.error || 'TXT record not found. Please check your DNS settings.');
      }
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifyingDomain(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!confirm('Are you sure you want to remove this custom domain?')) {
      return;
    }

    setSavingDomain(true);
    setDomainError(null);

    try {
      const response = await fetch(`/api/v1/workspaces/${workspaceId}/domain`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove domain');
      }

      setDomain('');
      setDomainToken('');
      setDomainVerified(false);
      setDomainSuccess('Domain removed');
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : 'Failed to remove domain');
    } finally {
      setSavingDomain(false);
    }
  };

  const timezoneHasChanges = timezone !== currentTimezone;
  const hasDomainConfigured = !!domainToken;

  return (
    <div className="space-y-6">
      {/* Timezone Setting */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-1">Timezone</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Used for displaying times in emails and booking confirmations.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white focus:border-amber-500/50 outline-none transition-colors"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleSaveTimezone}
            disabled={!timezoneHasChanges || savingTimezone}
            className={`px-6 py-2 rounded font-medium transition-colors ${
              timezoneHasChanges && !savingTimezone
                ? 'bg-amber-500 hover:bg-amber-600 text-black'
                : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {savingTimezone ? 'Saving...' : timezoneSaved ? 'Saved!' : 'Save'}
          </button>
        </div>

        {timezoneError && (
          <p className="mt-3 text-sm text-red-400">{timezoneError}</p>
        )}

        {timezoneSaved && (
          <p className="mt-3 text-sm text-green-400">Settings saved successfully.</p>
        )}
      </div>

      {/* Custom Domain Setting */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-medium text-white">Custom Domain</h3>
          {domainVerified && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Verified
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          Use your own domain for public booking pages (e.g., book.yourgym.com).
        </p>

        {/* Domain Input */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="book.yourdomain.com"
            disabled={hasDomainConfigured}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white font-mono text-sm focus:border-amber-500/50 outline-none transition-colors disabled:opacity-50"
          />
          
          {!hasDomainConfigured ? (
            <button
              onClick={handleSetupDomain}
              disabled={savingDomain || !domain.trim()}
              className={`px-6 py-2 rounded font-medium transition-colors ${
                domain.trim() && !savingDomain
                  ? 'bg-amber-500 hover:bg-amber-600 text-black'
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {savingDomain ? 'Setting up...' : 'Setup Domain'}
            </button>
          ) : (
            <button
              onClick={handleRemoveDomain}
              disabled={savingDomain}
              className="px-4 py-2 rounded font-medium text-red-400 hover:text-red-300 hover:bg-zinc-800 transition-colors"
            >
              Remove
            </button>
          )}
        </div>

        {/* Verification Instructions */}
        {hasDomainConfigured && !domainVerified && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">DNS Configuration</h4>
            
            <p className="text-xs text-zinc-400 mb-3">
              Add this TXT record to your DNS to verify ownership:
            </p>
            
            <div className="bg-zinc-900 rounded p-3 mb-4">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500">Type:</span>
                  <span className="ml-2 text-white font-mono">TXT</span>
                </div>
                <div>
                  <span className="text-zinc-500">Host:</span>
                  <span className="ml-2 text-white font-mono">_revline</span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-500">Value:</span>
                  <code className="ml-2 text-amber-400 font-mono text-xs break-all">
                    {domainToken}
                  </code>
                </div>
              </div>
            </div>

            <button
              onClick={handleVerifyDomain}
              disabled={verifyingDomain}
              className={`w-full py-2 rounded font-medium transition-colors ${
                !verifyingDomain
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {verifyingDomain ? 'Checking DNS...' : 'Verify Domain'}
            </button>
            
            <p className="text-xs text-zinc-600 mt-2 text-center">
              DNS changes can take up to 48 hours to propagate
            </p>
          </div>
        )}

        {/* Verified Domain Info */}
        {hasDomainConfigured && domainVerified && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-green-400">Domain verified and active</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Your booking page is now accessible at{' '}
                  <a 
                    href={`https://${domain}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:underline"
                  >
                    https://{domain}
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {domainError && (
          <p className="mt-3 text-sm text-red-400">{domainError}</p>
        )}

        {domainSuccess && (
          <p className="mt-3 text-sm text-green-400">{domainSuccess}</p>
        )}
      </div>

      {/* Info */}
      <div className="p-4 bg-zinc-800/30 border border-zinc-700/50 rounded-lg">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">About Settings</h4>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Timezone affects how times are displayed in booking confirmation emails</li>
          <li>• Custom domains require DNS configuration (CNAME and TXT records)</li>
          <li>• Domain verification proves you own the domain</li>
        </ul>
      </div>
    </div>
  );
}
