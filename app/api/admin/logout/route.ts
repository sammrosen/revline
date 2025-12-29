import { NextResponse } from 'next/server';
import {
  getSessionFromCookie,
  destroySession,
  clearSessionCookie,
} from '@/app/_lib/auth';

export async function POST() {
  try {
    const sessionId = await getSessionFromCookie();
    
    if (sessionId) {
      await destroySession(sessionId);
    }
    
    await clearSessionCookie();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookie even if session deletion fails
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}



