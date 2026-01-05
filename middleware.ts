/**
 * Next.js Middleware
 * 
 * Protects all /admin/* routes (except /admin/login) with authentication.
 * Checks session cookie and redirects to login if not authenticated.
 * 
 * STANDARDS:
 * - All admin routes protected automatically
 * - No manual auth checks needed in pages
 * - Passes adminId via headers for server components
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSession } from './app/_lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin routes (except /admin/login)
  const isAdminPage = pathname.startsWith('/admin');
  // Protect /api/admin routes (except /api/admin/login)
  const isAdminApi = pathname.startsWith('/api/admin');

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next();
  }

  // Allow access to login pages
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  // Get session cookie
  const sessionId = request.cookies.get('revline_admin_session')?.value;

  if (!sessionId) {
    // No session
    if (isAdminApi) {
      // API routes return 401
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      // Page routes redirect to login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Validate session
  const adminId = await validateSession(sessionId);

  if (!adminId) {
    // Invalid or expired session
    if (isAdminApi) {
      // API routes return 401
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      response.cookies.delete('revline_admin_session');
      return response;
    } else {
      // Page routes redirect to login
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('revline_admin_session');
      return response;
    }
  }

  // Valid session - add adminId to headers for server components and API routes
  const response = NextResponse.next();
  response.headers.set('x-admin-id', adminId);
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

