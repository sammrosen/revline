/**
 * Site configuration types for custom domain routing.
 * 
 * Sites are external business websites served on their own domains,
 * separate from the RevLine dashboard.
 */

/**
 * Configuration for an external site.
 */
export interface SiteConfig {
  /** Unique identifier for the site (used in routes) */
  siteId: string;
  /** Display name of the business/site */
  name: string;
  /** List of domains that should route to this site (production + preview) */
  domains: string[];
  /** Optional description for internal reference */
  description?: string;
}

/**
 * Result of resolving a domain to a site.
 */
export interface ResolvedSite {
  /** The site ID that was resolved */
  siteId: string;
  /** Full configuration for the resolved site */
  config: SiteConfig;
}
