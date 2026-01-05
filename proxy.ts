/**
 * Next.js Proxy
 * 
 * Handles two main responsibilities:
 * 1. Protects all /admin/* routes (except /admin/login and /admin/setup) with authentication.
 *    Checks session cookie and redirects to login if not authenticated.
 * 2. Routes custom domains to specific pages.
 * 
 * STANDARDS:
 * - All admin routes protected automatically
 * - No manual auth checks needed in pages
 * - Passes adminId via headers for server components
 * - /admin/setup only accessible when no admin exists (checked in the route itself)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSession } from './app/_lib/auth';

// Domain to route mapping
const DOMAIN_ROUTES: Record<string, string> = {
  // Custom domains pointing to specific pages
  'client1.com': '/client1',
  'www.client1.com': '/client1',
  'demo.example.com': '/demo',
  'fit1coaching.com': '/fit1',
  'www.fit1coaching.com': '/fit1',
  // Add more domain mappings here
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Handle admin authentication first
  // Protect /admin routes (except /admin/login)
  const isAdminPage = pathname.startsWith('/admin');
  // Protect /api/admin routes (except /api/admin/login)
  const isAdminApi = pathname.startsWith('/api/admin');

  if (isAdminPage || isAdminApi) {
    // Allow access to login, setup, and logout pages without authentication
    const publicAdminPaths = [
      '/admin/login',
      '/api/admin/login',
      '/api/admin/login/verify-2fa',
      '/admin/setup',
      '/api/admin/setup',
      '/api/admin/logout',
    ];
    
    if (publicAdminPaths.includes(pathname)) {
      // Continue to domain routing check below
    } else {
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
      
      // Check domain routing for admin routes too (in case admin is accessed via custom domain)
      const hostname = request.headers.get('host') || '';
      const targetPath = DOMAIN_ROUTES[hostname];
      
      if (targetPath) {
        const url = request.nextUrl.clone();
        url.pathname = targetPath;
        return NextResponse.rewrite(url);
      }
      
      return response;
    }
  }

  // 2. Handle domain routing
  const hostname = request.headers.get('host') || '';
  
  // Check if this hostname should be routed to a specific page
  const targetPath = DOMAIN_ROUTES[hostname];
  
  if (targetPath) {
    // Rewrite to the target path while keeping the custom domain in the URL
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    return NextResponse.rewrite(url);
  }
  
  // No special routing needed
  return NextResponse.next();
}

// Configure which paths this proxy runs on
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

