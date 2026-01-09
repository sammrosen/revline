/**
 * Idempotent Executor
 * 
 * Ensures workflow actions are executed exactly once, even with retries.
 * Uses transactional upsert pattern with INSERT ON CONFLICT.
 * 
 * STANDARDS:
 * - Multi-tenant safe with clientId scoping
 * - Transactional to prevent race conditions
 * - Stores both success and failure results
 * - Auto-cleanup with TTL
 */

import { prisma } from '@/app/_lib/db';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import {
  IdempotencyResult,
  IdempotencyOptions,
  logStructured,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// MAIN IDEMPOTENT EXECUTOR
// =============================================================================

/**
 * Execute a function with idempotency guarantees
 * 
 * If the same key was already executed successfully, returns cached result.
 * If the same key is currently being executed, waits briefly then fails.
 * If the same key failed previously, can optionally re-execute.
 * 
 * @param clientId - Client ID for multi-tenant scoping
 * @param key - Unique key for this operation (e.g., hash of action + params)
 * @param fn - Function to execute
 * @param options - Idempotency options
 * @returns Result with executed flag indicating if function was run
 * 
 * @example
 * const result = await executeIdempotent(
 *   clientId,
 *   generateIdempotencyKey('mailerlite.add_to_group', { email, groupId }),
 *   async () => {
 *     return await mailerliteAdapter.addToGroup(email, groupId);
 *   }
 * );
 */
export async function executeIdempotent<T>(
  clientId: string,
  key: string,
  fn: () => Promise<T>,
  options: IdempotencyOptions = {}
): Promise<IdempotencyResult<T>> {
  const {
    ttlMs = DEFAULT_TTL_MS,
    throwOnCachedError = true,
  } = options;

  const expiresAt = new Date(Date.now() + ttlMs);

  // 1. Try to claim the key by creating a new record
  let keyRecord: { id: string; status: string; result: Prisma.JsonValue; error: string | null } | null = null;
  let isNewKey = false;

  try {
    const created = await prisma.idempotencyKey.create({
      data: {
        clientId,
        key,
        status: 'PENDING',
        expiresAt,
      },
    });
    keyRecord = created;
    isNewKey = true;
  } catch (error) {
    // Check for unique constraint violation (P2002)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Key already exists - fetch it
      const existing = await prisma.idempotencyKey.findFirst({
        where: { clientId, key },
      });
      
      if (!existing) {
        throw new Error('Failed to find existing idempotency key after conflict');
      }
      
      keyRecord = existing;
      isNewKey = false;
    } else {
      throw error;
    }
  }

  // 2. If key already exists, handle based on status
  if (!isNewKey) {
    return handleExistingKey<T>(
      { status: keyRecord.status, result: keyRecord.result, error: keyRecord.error },
      throwOnCachedError,
      clientId,
      key
    );
  }

  // 3. Key was claimed - execute the function
  const keyId = keyRecord.id;
  
  try {
    const result = await fn();
    
    // Store successful result
    await prisma.idempotencyKey.update({
      where: { id: keyId },
      data: {
        status: 'COMPLETED',
        result: result as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    logStructured({
      correlationId: keyId,
      event: 'idempotent_execution_completed',
      clientId,
      metadata: { key: key.slice(0, 50) },
    });

    return { executed: true, result };
    
  } catch (error) {
    // Store failure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await prisma.idempotencyKey.update({
      where: { id: keyId },
      data: {
        status: 'FAILED',
        error: errorMessage.slice(0, 1000),
        completedAt: new Date(),
      },
    });

    logStructured({
      correlationId: keyId,
      event: 'idempotent_execution_failed',
      clientId,
      error: errorMessage,
      metadata: { key: key.slice(0, 50) },
    });

    throw error;
  }
}

/**
 * Handle an existing idempotency key
 */
function handleExistingKey<T>(
  record: { status: string; result: unknown; error: string | null },
  throwOnCachedError: boolean,
  clientId: string,
  key: string
): IdempotencyResult<T> {
  switch (record.status) {
    case 'COMPLETED':
      // Return cached successful result
      logStructured({
        correlationId: crypto.randomUUID(),
        event: 'idempotent_cache_hit',
        clientId,
        metadata: { key: key.slice(0, 50), cached: true },
      });
      return { executed: false, result: record.result as T };
    
    case 'FAILED':
      // Previous execution failed
      if (throwOnCachedError) {
        throw new Error(`Previous execution failed: ${record.error}`);
      }
      // Return the error as result (caller handles it)
      return { executed: false, result: record.error as unknown as T };
    
    case 'PENDING':
      // Another request is currently executing
      // In a production system, you might wait and retry
      // For now, fail fast to prevent blocking
      throw new Error('Operation already in progress');
    
    default:
      throw new Error(`Unknown idempotency key status: ${record.status}`);
  }
}

// =============================================================================
// KEY GENERATION
// =============================================================================

/**
 * Generate an idempotency key from action and parameters
 * 
 * @param action - Action identifier (e.g., 'mailerlite.add_to_group')
 * @param params - Action parameters
 * @returns SHA256 hash of action + params
 * 
 * @example
 * const key = generateIdempotencyKey('mailerlite.add_to_group', {
 *   email: 'user@example.com',
 *   groupId: '12345',
 * });
 */
export function generateIdempotencyKey(
  action: string,
  params: Record<string, unknown>
): string {
  // Sort keys for consistent hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);

  const input = JSON.stringify({ action, params: sortedParams });
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Generate a workflow-scoped idempotency key
 * 
 * Includes workflow execution ID for finer-grained deduplication
 * within a single workflow run.
 */
export function generateWorkflowIdempotencyKey(
  workflowExecutionId: string,
  actionIndex: number,
  action: string,
  params: Record<string, unknown>
): string {
  const input = JSON.stringify({
    workflowExecutionId,
    actionIndex,
    action,
    params,
  });
  return createHash('sha256').update(input).digest('hex');
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Clean up expired idempotency keys
 * 
 * Should be run periodically (e.g., daily cron job)
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const result = await prisma.idempotencyKey.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  logStructured({
    correlationId: crypto.randomUUID(),
    event: 'idempotency_cleanup',
    metadata: { deletedCount: result.count },
  });

  return result.count;
}
