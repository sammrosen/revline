/**
 * Next.js Proxy
 * 
 * Handles two main responsibilities:
 * 1. Protects app routes (workspaces, settings, etc.) with authentication.
 *    Checks session cookie and redirects to login if not authenticated.
 * 2. Routes custom domains to specific pages.
 * 
 * STANDARDS:
 * - All app routes protected automatically
 * - No manual auth checks needed in pages
 * - Passes userId via x-user-id header for server components
 * - /setup only accessible when no users exist (checked in the route itself)
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

// Protected page routes (require authentication)
const PROTECTED_PAGE_PREFIXES = [
  '/workspaces',
  '/settings',
  '/docs',
  '/onboarding',
];

// Protected API routes (require authentication)
const PROTECTED_API_PREFIXES = [
  '/api/v1/workspaces',
  '/api/v1/integrations',
  '/api/v1/workflows',
  '/api/v1/forms',
  '/api/v1/executions',
  '/api/v1/check-form-id',
  '/api/v1/workflow-registry',
  '/api/v1/auth/2fa',
];

// Public auth routes (no authentication required)
const PUBLIC_AUTH_PATHS = [
  '/login',
  '/setup',
  '/api/v1/auth/login',
  '/api/v1/auth/login/verify-2fa',
  '/api/v1/auth/setup',
  '/api/v1/auth/logout',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected page
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(prefix => 
    pathname.startsWith(prefix)
  );
  
  // Check if this is a protected API route
  const isProtectedApi = PROTECTED_API_PREFIXES.some(prefix => 
    pathname.startsWith(prefix)
  );

  // Check if this is a public auth path
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.includes(pathname);

  if ((isProtectedPage || isProtectedApi) && !isPublicAuthPath) {
    // Get session cookie
    const sessionId = request.cookies.get('revline_session')?.value;

    if (!sessionId) {
      // No session
      if (isProtectedApi) {
        // API routes return 401
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      } else {
        // Page routes redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    // Validate session
    const userId = await validateSession(sessionId);

    if (!userId) {
      // Invalid or expired session
      if (isProtectedApi) {
        // API routes return 401
        const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        response.cookies.delete('revline_session');
        return response;
      } else {
        // Page routes redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('revline_session');
        return response;
      }
    }

    // Valid session - add userId to headers for server components and API routes
    const response = NextResponse.next();
    response.headers.set('x-user-id', userId);
    
    // Check domain routing for app routes too (in case accessed via custom domain)
    const hostname = request.headers.get('host') || '';
    const targetPath = DOMAIN_ROUTES[hostname];
    
    if (targetPath) {
      const url = request.nextUrl.clone();
      url.pathname = targetPath;
      return NextResponse.rewrite(url);
    }
    
    return response;
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
