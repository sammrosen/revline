import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteById } from '@/app/_lib/sites';

interface SiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
}

/**
 * Generate metadata dynamically based on site config.
 */
export async function generateMetadata({ params }: SiteLayoutProps): Promise<Metadata> {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  
  if (!site) {
    return {
      title: 'Site Not Found',
    };
  }
  
  return {
    title: site.name,
    description: site.description,
  };
}

/**
 * Layout for external sites.
 * Clean wrapper with no RevLine branding.
 */
export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  
  // If the siteId doesn't exist in registry, 404
  if (!site) {
    notFound();
  }
  
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
