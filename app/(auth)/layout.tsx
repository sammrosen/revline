import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'RevLine - Login',
  robots: 'noindex, nofollow',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {children}
    </div>
  )
}
