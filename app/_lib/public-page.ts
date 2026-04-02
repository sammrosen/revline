/**
 * Shared helpers for public-facing page routes.
 *
 * Wraps workspace DB lookups in try/catch with structured logging,
 * and deduplicates queries within a single request via React cache().
 */

import { cache } from 'react';
import { prisma } from '@/app/_lib/db';
import { logStructured } from '@/app/_lib/reliability/types';

export interface PublicWorkspace {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
}

/**
 * Load a workspace by slug — deduplicated within a single RSC request.
 * Returns null (not throws) on DB errors so the caller can show a
 * graceful error page instead of an unhandled 500.
 */
export const getWorkspaceBySlug = cache(async (slug: string): Promise<PublicWorkspace | null> => {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: slug.toLowerCase() },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    return workspace as PublicWorkspace | null;
  } catch (error) {
    logStructured({
      correlationId: slug,
      event: 'public_page_db_error',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: { slug },
    });
    return null;
  }
});
