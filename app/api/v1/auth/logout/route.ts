import { NextRequest, NextResponse } from 'next/server';
import { destroySession, clearSessionCookie } from '@/app/_lib/auth';

/**
 * POST /api/v1/auth/logout
 * 
 * Logs out the current admin by destroying the session and clearing the cookie.
 */
export async function POST(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = request.cookies.get('revline_admin_session')?.value;

    if (sessionId) {
      // Destroy the session in the database
      await destroySession(sessionId);
    }

    // Clear the session cookie
    await clearSessionCookie();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Even on error, try to clear the cookie
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}

