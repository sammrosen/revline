/**
 * Site registry for domain-to-site resolution.
 * 
 * This is a file-based configuration that can be migrated to database
 * storage later without changing the public API.
 */

import type { SiteConfig, ResolvedSite } from './types';

/**
 * Registry of all external sites.
 * Add new sites here with their associated domains.
 */
const SITE_REGISTRY: SiteConfig[] = [
  {
    siteId: 'rosen-systems',
    name: 'Rosen Systems',
    description: 'System infrastructure and automation for service-based businesses.',
    domains: [
      // Production
      'rosensystems.io',
      'www.rosensystems.io',
      // Local development (add to hosts file: 127.0.0.1 rosensystems.local)
      'rosensystems.local',
      'rosensystems.local:3000',
    ],
  },
];

/**
 * Normalize a hostname for comparison.
 * Strips port numbers and lowercases.
 */
function normalizeHost(host: string): string {
  // Remove port if present (but keep localhost:3000 for dev matching)
  const normalized = host.toLowerCase().trim();
  return normalized;
}

/**
 * Resolve a domain/host to a site configuration.
 * 
 * @param host - The hostname from the request (e.g., "rosensystems.com" or "rosensystems.com:3000")
 * @returns The resolved site or null if no match found
 */
export function resolveSiteByDomain(host: string): ResolvedSite | null {
  const normalizedHost = normalizeHost(host);
  
  // Also check without port for standard domain matching
  const hostWithoutPort = normalizedHost.split(':')[0];
  
  for (const config of SITE_REGISTRY) {
    for (const domain of config.domains) {
      const normalizedDomain = normalizeHost(domain);
      
      // Match either exact host or host without port
      if (normalizedDomain === normalizedHost || normalizedDomain === hostWithoutPort) {
        return {
          siteId: config.siteId,
          config,
        };
      }
    }
  }
  
  return null;
}

/**
 * Get a site configuration by its ID.
 * 
 * @param siteId - The site identifier
 * @returns The site config or null if not found
 */
export function getSiteById(siteId: string): SiteConfig | null {
  return SITE_REGISTRY.find(site => site.siteId === siteId) ?? null;
}

/**
 * Get all registered site IDs.
 * Useful for static generation or validation.
 */
export function getAllSiteIds(): string[] {
  return SITE_REGISTRY.map(site => site.siteId);
}

/**
 * Check if a given siteId is valid/registered.
 */
export function isValidSiteId(siteId: string): boolean {
  return SITE_REGISTRY.some(site => site.siteId === siteId);
}
