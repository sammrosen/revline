/**
 * Next.js Proxy
 * 
 * Handles four main responsibilities:
 * 1. Global rate limiting safety net for API routes
 * 2. Protects app routes (workspaces, settings, etc.) with authentication.
 *    Checks session cookie and redirects to login if not authenticated.
 * 3. Routes custom domains to workspace-specific pages (dynamic DB lookup for templates).
 * 4. Routes static site domains via the sites module (for non-workspace sites).
 * 
 * STANDARDS:
 * - All app routes protected automatically
 * - No manual auth checks needed in pages
 * - Passes userId via x-user-id header for server components
 * - /setup only accessible when no users exist (checked in the route itself)
 * - Global rate limit is a safety net; routes implement their own specific limits
 * - Custom workspace domains resolved via direct DB lookup (no caching for reliability)
 * - Static site domains are configured in app/_lib/sites/registry.ts
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSession } from './app/_lib/auth';
import { prisma } from './app/_lib/db';
import { resolveSiteByDomain } from './app/_lib/sites';

// =============================================================================
// GLOBAL RATE LIMITING (Safety Net)
// =============================================================================
// In-memory store - resets on server restart (acceptable for safety net)
// For production multi-instance, route-level limits with Redis would be needed
const GLOBAL_RATE_LIMIT_STORE = new Map<string, { count: number; resetAt: number }>();
const GLOBAL_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const GLOBAL_RATE_LIMIT_MAX = 300; // 300 requests per minute per IP (safety net; routes have own limits)

/**
 * Get client IP from request headers
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

/**
 * Check global rate limit for an IP
 * Returns true if allowed, false if rate limited
 */
function checkGlobalRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = GLOBAL_RATE_LIMIT_STORE.get(ip);
  
  // Clean up expired entries periodically (every 100th request)
  if (Math.random() < 0.01) {
    for (const [key, val] of GLOBAL_RATE_LIMIT_STORE.entries()) {
      if (val.resetAt < now) {
        GLOBAL_RATE_LIMIT_STORE.delete(key);
      }
    }
  }
  
  if (!entry || entry.resetAt < now) {
    GLOBAL_RATE_LIMIT_STORE.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= GLOBAL_RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

// =============================================================================
// CUSTOM DOMAIN RESOLUTION
// =============================================================================

/**
 * Resolve custom domain to workspace slug via direct DB lookup
 * 
 * RELIABILITY: Direct lookup on every request (no caching)
 * - Ensures immediate propagation of domain changes
 * - Simple logic with no cache invalidation concerns
 * - Database query is indexed on customDomain field
 * 
 * @param hostname - The hostname from the request
 * @returns Workspace slug if found and verified, null otherwise
 */
async function resolveCustomDomain(hostname: string): Promise<string | null> {
  // Skip localhost and known system domains
  if (
    hostname.includes('localhost') ||
    hostname.includes('railway.app') ||
    hostname.includes('revline.io') ||
    hostname.includes('vercel.app')
  ) {
    return null;
  }

  try {
    const workspace = await prisma.workspace.findFirst({
      where: {
        customDomain: hostname.toLowerCase(),
        domainVerified: true, // Only route verified domains
      },
      select: {
        slug: true,
      },
    });

    return workspace?.slug ?? null;
  } catch (error) {
    // Log but don't fail the request - fall through to normal routing
    console.error('Custom domain lookup error:', {
      hostname,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

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

  // 1. Global rate limiting for API routes (safety net)
  if (pathname.startsWith('/api/')) {
    const clientIP = getClientIP(request);
    if (!checkGlobalRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { 
          status: 429, 
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': String(GLOBAL_RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }
  }

  // 2. Check if this is a protected page
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
    return response;
  }

  // 3. Handle domain routing for public pages
  const hostname = request.headers.get('host') || '';
  
  // 3a. Check static site domains first (file-based registry for non-workspace sites)
  const resolvedSite = resolveSiteByDomain(hostname);
  if (resolvedSite) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? `/${resolvedSite.siteId}` : `/${resolvedSite.siteId}${pathname}`;
    return NextResponse.rewrite(url);
  }
  
  // 3b. Check dynamic custom domains (database lookup for workspace templates)
  // Only for non-API, non-dashboard routes
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/workspaces')) {
    const workspaceSlug = await resolveCustomDomain(hostname);
    
    if (workspaceSlug) {
      // Route to workspace's booking page
      // Custom domains route to /public/[slug]/book by default
      const url = request.nextUrl.clone();
      
      // If accessing root of custom domain, go to booking page
      if (pathname === '/' || pathname === '') {
        url.pathname = `/public/${workspaceSlug}/book`;
      } else {
        // For other paths, prepend /public/[slug]
        url.pathname = `/public/${workspaceSlug}${pathname}`;
      }
      
      return NextResponse.rewrite(url);
    }
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
