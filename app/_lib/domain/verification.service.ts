/**
 * Domain Verification Service
 * 
 * Handles custom domain verification via DNS TXT records.
 * 
 * Flow:
 * 1. User adds custom domain in workspace settings
 * 2. RevLine generates verification token
 * 3. User adds TXT record: _revline.domain.com → revline-verify-{token}
 * 4. User clicks "Verify" 
 * 5. This service checks DNS and updates workspace
 * 
 * STANDARDS:
 * - Crypto-secure token generation
 * - Clear error messages for debugging
 * - Never throws - returns result objects
 */

import { randomBytes } from 'crypto';
import { resolveTxt } from 'dns/promises';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';

// =============================================================================
// TYPES
// =============================================================================

export interface DomainVerificationResult {
  success: boolean;
  verified?: boolean;
  error?: string;
  details?: string;
}

export interface DomainConfigResult {
  success: boolean;
  token?: string;
  instructions?: string;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Prefix for TXT record hostname */
const TXT_RECORD_PREFIX = '_revline';

/** Prefix for verification token value */
const TOKEN_PREFIX = 'revline-verify-';

/** Token length in bytes (will be hex encoded = 32 chars) */
const TOKEN_BYTES = 16;

// =============================================================================
// TOKEN GENERATION
// =============================================================================

/**
 * Generate a cryptographically secure verification token
 * Format: revline-verify-{32 hex chars}
 */
export function generateVerificationToken(): string {
  const randomPart = randomBytes(TOKEN_BYTES).toString('hex');
  return `${TOKEN_PREFIX}${randomPart}`;
}

// =============================================================================
// DOMAIN VALIDATION
// =============================================================================

/**
 * Validate domain format
 * Returns error message if invalid, null if valid
 */
export function validateDomainFormat(domain: string): string | null {
  if (!domain) {
    return 'Domain is required';
  }

  // Remove protocol if present
  const cleaned = domain.replace(/^https?:\/\//, '').toLowerCase();

  // Basic domain format check
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  if (!domainRegex.test(cleaned)) {
    return 'Invalid domain format. Example: book.yourdomain.com';
  }

  // Disallow our own domains
  if (cleaned.includes('revline.io') || cleaned.includes('railway.app') || cleaned.includes('localhost')) {
    return 'Cannot use RevLine system domains';
  }

  return null;
}

/**
 * Clean and normalize domain string
 */
export function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').toLowerCase().trim();
}

// =============================================================================
// DNS VERIFICATION
// =============================================================================

/**
 * Verify domain ownership via TXT record lookup
 * 
 * @param domain - The domain to verify (e.g., "book.clientgym.com")
 * @param expectedToken - The verification token to look for
 */
export async function verifyDomainOwnership(
  domain: string,
  expectedToken: string
): Promise<DomainVerificationResult> {
  const recordName = `${TXT_RECORD_PREFIX}.${domain}`;
  
  try {
    // Query DNS for TXT records
    const records = await resolveTxt(recordName);
    
    // Flatten the records (DNS returns array of arrays)
    const flatRecords = records.flat();
    
    // Check if expected token is present
    if (flatRecords.includes(expectedToken)) {
      return { 
        success: true, 
        verified: true,
        details: `Found matching TXT record at ${recordName}`,
      };
    }
    
    // Token not found but records exist
    return {
      success: true,
      verified: false,
      error: 'TXT record found but token does not match',
      details: `Expected: ${expectedToken}\nFound: ${flatRecords.join(', ')}`,
    };
    
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    
    // Common DNS errors
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      return {
        success: true, // DNS lookup succeeded, just no record
        verified: false,
        error: `No TXT record found at ${recordName}`,
        details: `Add a TXT record with:\n  Host: ${TXT_RECORD_PREFIX}\n  Value: ${expectedToken}`,
      };
    }
    
    if (error.code === 'ETIMEOUT') {
      return {
        success: false,
        error: 'DNS lookup timed out. Please try again.',
      };
    }
    
    // Unexpected error
    console.error('DNS verification error:', {
      domain,
      code: error.code,
      message: error.message,
    });
    
    return {
      success: false,
      error: `DNS lookup failed: ${error.message}`,
    };
  }
}

// =============================================================================
// WORKSPACE DOMAIN MANAGEMENT
// =============================================================================

/**
 * Set up custom domain for a workspace
 * Generates verification token and returns instructions
 */
export async function setupCustomDomain(
  workspaceId: string,
  domain: string
): Promise<DomainConfigResult> {
  // Validate domain format
  const formatError = validateDomainFormat(domain);
  if (formatError) {
    return { success: false, error: formatError };
  }

  const normalizedDomain = normalizeDomain(domain);

  // Check if domain is already in use by another workspace
  const existing = await prisma.workspace.findFirst({
    where: {
      customDomain: normalizedDomain,
      NOT: { id: workspaceId },
    },
    select: { id: true },
  });

  if (existing) {
    return { 
      success: false, 
      error: 'This domain is already configured for another workspace',
    };
  }

  // Generate verification token
  const token = generateVerificationToken();

  // Update workspace with domain and token
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      customDomain: normalizedDomain,
      domainVerifyToken: token,
      domainVerified: false,
      domainVerifiedAt: null,
    },
  });

  await emitEvent({
    workspaceId,
    system: EventSystem.BACKEND,
    eventType: 'domain_setup_initiated',
    success: true,
  });

  // Build instructions
  const instructions = `
Add a TXT record to your DNS:

Host/Name: ${TXT_RECORD_PREFIX}
Type: TXT
Value: ${token}

After adding the record, click "Verify" to confirm ownership.
DNS changes can take up to 48 hours to propagate, but usually happen within minutes.
  `.trim();

  return {
    success: true,
    token,
    instructions,
  };
}

/**
 * Verify and activate custom domain for a workspace
 */
export async function verifyAndActivateDomain(
  workspaceId: string
): Promise<DomainVerificationResult> {
  // Get workspace domain config
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      customDomain: true,
      domainVerifyToken: true,
      domainVerified: true,
    },
  });

  if (!workspace) {
    return { success: false, error: 'Workspace not found' };
  }

  if (!workspace.customDomain || !workspace.domainVerifyToken) {
    return { success: false, error: 'No custom domain configured' };
  }

  if (workspace.domainVerified) {
    return { success: true, verified: true, details: 'Domain already verified' };
  }

  // Verify via DNS
  const result = await verifyDomainOwnership(
    workspace.customDomain,
    workspace.domainVerifyToken
  );

  if (result.success && result.verified) {
    // Update workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        domainVerified: true,
        domainVerifiedAt: new Date(),
      },
    });

    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'domain_verified',
      success: true,
    });

    return {
      success: true,
      verified: true,
      details: `Domain ${workspace.customDomain} verified and activated`,
    };
  }

  await emitEvent({
    workspaceId,
    system: EventSystem.BACKEND,
    eventType: 'domain_verification_failed',
    success: false,
    errorMessage: result.error,
  });

  return result;
}

/**
 * Remove custom domain from a workspace
 */
export async function removeCustomDomain(
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        customDomain: null,
        domainVerifyToken: null,
        domainVerified: false,
        domainVerifiedAt: null,
      },
    });

    await emitEvent({
      workspaceId,
      system: EventSystem.BACKEND,
      eventType: 'domain_removed',
      success: true,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to remove custom domain:', {
      workspaceId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to remove domain' };
  }
}

/**
 * Get domain instructions for display
 */
export function getDomainInstructions(domain: string, token: string): string {
  return `
## DNS Configuration

Add the following TXT record to verify domain ownership:

| Type | Host | Value |
|------|------|-------|
| TXT | ${TXT_RECORD_PREFIX} | ${token} |

After verification, add a CNAME record to route traffic:

| Type | Host | Value |
|------|------|-------|
| CNAME | ${domain.split('.')[0]} | cname.revline.io |

**Note:** DNS changes can take up to 48 hours to propagate.
  `.trim();
}
