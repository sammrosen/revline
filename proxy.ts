import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export function proxy(request: NextRequest) {
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

// Configure which paths this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

