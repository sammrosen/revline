import type { Metadata } from 'next'
import { ServiceWorkerRegistration } from './_components/ServiceWorkerRegistration'

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen">
      <ServiceWorkerRegistration />
      {children}
    </div>
  )
}

