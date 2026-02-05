import { notFound } from 'next/navigation';
import { getSiteById, getAllSiteIds } from '@/app/_lib/sites';

interface SitePageProps {
  params: Promise<{ siteId: string }>;
}

/**
 * Generate static params for all known sites.
 * This enables static generation for registered sites.
 */
export function generateStaticParams(): { siteId: string }[] {
  return getAllSiteIds().map(siteId => ({ siteId }));
}

/**
 * Dynamic site landing page.
 * 
 * This serves as a fallback for sites that don't have a dedicated
 * static route (e.g., app/(sites)/rosen-systems/page.tsx).
 * 
 * In practice, most sites will have their own dedicated page.tsx
 * that takes precedence over this dynamic route.
 */
export default async function SitePage({ params }: SitePageProps) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  
  if (!site) {
    notFound();
  }
  
  // Default placeholder for sites without a dedicated page
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <h1 className="text-4xl font-bold">{site.name}</h1>
        {site.description && (
          <p className="text-xl text-zinc-400 max-w-md">
            {site.description}
          </p>
        )}
        <p className="text-sm text-zinc-600 mt-8">
          Site coming soon
        </p>
      </div>
    </div>
  );
}
