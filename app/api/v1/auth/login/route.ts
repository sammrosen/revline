import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyPassword,
  createSession,
  setSessionCookie,
  getUserByEmail,
} from '@/app/_lib/auth';
import * as crypto from 'crypto';
import { rateLimitByIP, getClientIP, getRateLimitHeaders } from '@/app/_lib/middleware';

// Strict rate limit for login: 5 attempts per 5 minutes
const LOGIN_RATE_LIMIT = { requests: 5, windowMs: 300000 };

const TEMP_TOKEN_COOKIE = 'revline_2fa_temp';
const TEMP_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a signed temp token containing user ID
 * Uses HMAC to sign the data so it can't be tampered with
 */
function createSignedTempToken(userId: string): string {
  const expiresAt = Date.now() + TEMP_TOKEN_EXPIRY_MS;
  const data = `${userId}:${expiresAt}`;
  const secret = process.env.REVLINE_ENCRYPTION_KEY || 'dev-secret-key';
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(`${data}:${signature}`).toString('base64');
}

/**
 * Verify and decode a signed temp token
 * Returns user ID if valid, null if invalid or expired
 */
function verifySignedTempToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    
    if (parts.length !== 3) {
      return null;
    }
    
    const [userId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    
    // Check expiry
    if (Date.now() > expiresAt) {
      return null;
    }
    
    // Verify signature
    const data = `${userId}:${expiresAtStr}`;
    const secret = process.env.REVLINE_ENCRYPTION_KEY || 'dev-secret-key';
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    
    return userId;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit check - prevent brute force attacks
    const clientIP = getClientIP(request.headers);
    const rateLimit = rateLimitByIP(clientIP || 'unknown', LOGIN_RATE_LIMIT);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Look up user by email
    const user = await getUserByEmail(email);

    if (!user) {
      // Use generic error to prevent email enumeration
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if 2FA is enabled
    if (user.totpEnabled) {
      // Create a signed temp token (stored in cookie, survives recompiles)
      const tempToken = createSignedTempToken(user.id);
      
      // Set cookie
      const cookieStore = await cookies();
      cookieStore.set(TEMP_TOKEN_COOKIE, tempToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 300, // 5 minutes
      });

      return NextResponse.json({
        requires2FA: true,
        tempToken, // Also return in response for the client to send back
      });
    }

    // No 2FA - create session directly
    const sessionId = await createSession(user.id);
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

/**
 * Validate a temp token and return the associated user ID
 * Checks both the cookie and the provided token
 */
export async function validateTempToken(providedToken: string): Promise<string | null> {
  // First try the provided token
  let userId = verifySignedTempToken(providedToken);
  if (userId) return userId;
  
  // Fall back to cookie (in case token wasn't passed correctly)
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(TEMP_TOKEN_COOKIE)?.value;
    if (cookieToken) {
      userId = verifySignedTempToken(cookieToken);
    }
  } catch {
    // Ignore cookie errors
  }
  
  return userId;
}

/**
 * Clear the temp token cookie after successful 2FA
 */
export async function clearTempTokenCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(TEMP_TOKEN_COOKIE);
  } catch {
    // Ignore errors
  }
}
