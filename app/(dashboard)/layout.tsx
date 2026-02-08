import type { Metadata } from 'next'
import { ServiceWorkerRegistration } from './_components/ServiceWorkerRegistration'
import { DashboardShell } from './_components/DashboardShell'
import { getUserIdFromHeaders } from '@/app/_lib/auth'
import { getUserOrgs, getCurrentOrg } from '@/app/_lib/organization-access'
import { prisma } from '@/app/_lib/db'

export const metadata: Metadata = {
  title: 'RevLine Admin',
  robots: 'noindex, nofollow',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RevLine',
  },
  formatDetection: {
    telephone: false,
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get authenticated user
  const userId = await getUserIdFromHeaders();
  
  // If not authenticated, middleware should handle redirect
  // But we still need to handle the case where userId is null for the sidebar
  let organizations: { id: string; name: string; slug: string }[] = [];
  let currentOrg: { id: string; name: string; slug: string } | null = null;
  let user: { id: string; email: string; name: string | null } | null = null;

  if (userId) {
    // Fetch user, orgs, and current org in parallel
    const [userOrgs, org, userData] = await Promise.all([
      getUserOrgs(userId),
      getCurrentOrg(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true },
      }),
    ]);

    organizations = userOrgs.map((o) => ({ id: o.id, name: o.name, slug: o.slug }));
    currentOrg = org ? { id: org.id, name: org.name, slug: org.slug } : null;
    user = userData;
  }

  return (
    <>
      <ServiceWorkerRegistration />
      <DashboardShell
        organizations={organizations}
        currentOrg={currentOrg}
        user={user}
      >
        {children}
      </DashboardShell>
    </>
  )
}

