/**
 * Site routing module.
 * 
 * Provides domain-to-site resolution for serving external business
 * websites on their own custom domains.
 */

export type { SiteConfig, ResolvedSite } from './types';

export {
  resolveSiteByDomain,
  getSiteById,
  getAllSiteIds,
  isValidSiteId,
} from './registry';
