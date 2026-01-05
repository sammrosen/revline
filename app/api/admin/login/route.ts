import { NextRequest, NextResponse } from 'next/server';
import {
  getAdmin,
  verifyPassword,
  createSession,
  setSessionCookie,
} from '@/app/_lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Get the single admin account
    const admin = await getAdmin();
    if (!admin) {
      // No admin exists - this shouldn't happen in production
      return NextResponse.json(
        { error: 'Admin not configured' },
        { status: 500 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Create session and set cookie
    const sessionId = await createSession(admin.id);
    await setSessionCookie(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

