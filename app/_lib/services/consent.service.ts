/**
 * Consent Service
 *
 * Platform-level consent record management. Tracks per-workspace,
 * per-contact, per-channel consent for TCPA and regulatory compliance.
 *
 * The agent engine and any future caller (signup forms, marketing
 * automation, compliance audit APIs) consume this service — consent
 * is not owned by the agent module.
 *
 * STANDARDS:
 * - Workspace-isolated: every query scoped to workspaceId
 * - Event-driven: emits consent_granted, consent_revoked
 * - Fail-safe: no consent record = blocked (deny by default)
 *   DB errors in checkConsent return null (deny). DB errors in
 *   revokeConsent/recordConsent are logged but don't crash callers.
 * - Never delete consent records — soft revoke via revokedAt
 */

import { prisma } from '@/app/_lib/db';
import { ConsentType, ConsentMethod } from '@prisma/client';
import { logStructured } from '@/app/_lib/reliability';

export { ConsentType, ConsentMethod };

export interface RecordConsentParams {
  workspaceId: string;
  contactAddress: string;
  channel: string;
  consentType: ConsentType;
  method: ConsentMethod;
  languagePresented: string;
  ipAddress?: string;
  expiresAt?: Date;
}

export interface ConsentRecord {
  id: string;
  workspaceId: string;
  contactAddress: string;
  channel: string;
  consentType: ConsentType;
  method: ConsentMethod;
  languagePresented: string;
  ipAddress: string | null;
  grantedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/**
 * Record or re-grant consent for a contact on a specific channel.
 * If a revoked record exists for the same (workspace, contact, channel),
 * it is replaced with a fresh grant.
 */
export async function recordConsent(
  params: RecordConsentParams
): Promise<ConsentRecord | null> {
  const channel = params.channel.toUpperCase();

  try {
    const record = await prisma.consentRecord.upsert({
      where: {
        workspaceId_contactAddress_channel: {
          workspaceId: params.workspaceId,
          contactAddress: params.contactAddress,
          channel,
        },
      },
      update: {
        consentType: params.consentType,
        method: params.method,
        languagePresented: params.languagePresented,
        ipAddress: params.ipAddress ?? null,
        grantedAt: new Date(),
        expiresAt: params.expiresAt ?? null,
        revokedAt: null,
      },
      create: {
        workspaceId: params.workspaceId,
        contactAddress: params.contactAddress,
        channel,
        consentType: params.consentType,
        method: params.method,
        languagePresented: params.languagePresented,
        ipAddress: params.ipAddress ?? null,
        expiresAt: params.expiresAt ?? null,
      },
    });

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'consent_granted',
      workspaceId: params.workspaceId,
      provider: 'consent',
      success: true,
      metadata: {
        channel,
        consentType: params.consentType,
        method: params.method,
      },
    });

    return record;
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'consent_record_failed',
      workspaceId: params.workspaceId,
      provider: 'consent',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown',
      metadata: { channel },
    });
    return null;
  }
}

/**
 * Check whether a contact has active (non-revoked, non-expired) consent
 * on a given channel. Returns the record if valid, null otherwise.
 * Fail-safe: DB errors return null (deny by default).
 */
export async function checkConsent(
  workspaceId: string,
  contactAddress: string,
  channel: string
): Promise<ConsentRecord | null> {
  try {
    const record = await prisma.consentRecord.findUnique({
      where: {
        workspaceId_contactAddress_channel: {
          workspaceId,
          contactAddress,
          channel: channel.toUpperCase(),
        },
      },
    });

    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    return record;
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'consent_check_failed',
      workspaceId,
      provider: 'consent',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown',
      metadata: { channel: channel.toUpperCase() },
    });
    return null;
  }
}

/**
 * Soft-revoke consent for a contact on a specific channel.
 * Sets revokedAt but never deletes the record (regulatory retention).
 * Returns true if a record was revoked, false if no active record existed.
 * DB errors are logged but don't crash the caller.
 */
export async function revokeConsent(
  workspaceId: string,
  contactAddress: string,
  channel: string
): Promise<boolean> {
  const normalizedChannel = channel.toUpperCase();

  try {
    const record = await prisma.consentRecord.findUnique({
      where: {
        workspaceId_contactAddress_channel: {
          workspaceId,
          contactAddress,
          channel: normalizedChannel,
        },
      },
    });

    if (!record || record.revokedAt) return false;

    await prisma.consentRecord.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'consent_revoked',
      workspaceId,
      provider: 'consent',
      success: true,
      metadata: {
        channel: normalizedChannel,
        consentRecordId: record.id,
      },
    });

    return true;
  } catch (err) {
    logStructured({
      correlationId: crypto.randomUUID(),
      event: 'consent_revoke_failed',
      workspaceId,
      provider: 'consent',
      success: false,
      error: err instanceof Error ? err.message : 'Unknown',
      metadata: { channel: normalizedChannel },
    });
    return false;
  }
}
