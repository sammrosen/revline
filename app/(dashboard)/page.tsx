import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // Middleware handles auth - if we reach here, user is authenticated
  redirect('/workspaces');
}

