/**
 * Transaction Utilities
 * 
 * Provides helper functions for database transactions to ensure atomicity
 * of multi-step operations (e.g., lead creation + event emission).
 */

import { prisma } from '../db';
import type { Prisma } from '@prisma/client';

/**
 * Execute a callback within a database transaction
 * 
 * @param callback Function that receives a transaction client and returns a promise
 * @returns The result of the callback
 * 
 * @example
 * ```ts
 * const result = await withTransaction(async (tx) => {
 *   const lead = await tx.lead.create({ data: {...} });
 *   await tx.event.create({ data: {...} });
 *   return lead;
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(callback);
}

