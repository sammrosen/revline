import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/app/_lib/db';
import {
  verifyPassword,
  createSession,
  setSessionCookie,
} from '@/app/_lib/auth';
import * as crypto from 'crypto';

const TEMP_TOKEN_COOKIE = 'revline_2fa_temp';
const TEMP_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a signed temp token containing admin ID
 * Uses HMAC to sign the data so it can't be tampered with
 */
function createSignedTempToken(adminId: string): string {
  const expiresAt = Date.now() + TEMP_TOKEN_EXPIRY_MS;
  const data = `${adminId}:${expiresAt}`;
  const secret = process.env.REVLINE_ENCRYPTION_KEY || 'dev-secret-key';
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(`${data}:${signature}`).toString('base64');
}

/**
 * Verify and decode a signed temp token
 * Returns admin ID if valid, null if invalid or expired
 */
function verifySignedTempToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    
    console.log('[2FA Debug] Token parts count:', parts.length);
    
    if (parts.length !== 3) {
      console.log('[2FA Debug] Invalid parts count, expected 3');
      return null;
    }
    
    const [adminId, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    
    console.log('[2FA Debug] Admin ID:', adminId);
    console.log('[2FA Debug] Expires at:', new Date(expiresAt).toISOString());
    console.log('[2FA Debug] Now:', new Date().toISOString());
    
    // Check expiry
    if (Date.now() > expiresAt) {
      console.log('[2FA Debug] Token expired');
      return null;
    }
    
    // Verify signature
    const data = `${adminId}:${expiresAtStr}`;
    const secret = process.env.REVLINE_ENCRYPTION_KEY || 'dev-secret-key';
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');
    
    console.log('[2FA Debug] Signature match:', signature === expectedSignature);
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.log('[2FA Debug] Signature mismatch');
      return null;
    }
    
    console.log('[2FA Debug] Token valid!');
    return adminId;
  } catch (err) {
    console.log('[2FA Debug] Error verifying token:', err);
    return null;
  }
}

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

    // Get the single admin account with 2FA info
    const admin = await prisma.admin.findFirst({
      select: {
        id: true,
        passwordHash: true,
        totpEnabled: true,
      },
    });

    if (!admin) {
      // No admin exists - redirect to setup
      return NextResponse.json(
        { error: 'Admin not configured', setupRequired: true },
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

    // Check if 2FA is enabled
    if (admin.totpEnabled) {
      // Create a signed temp token (stored in cookie, survives recompiles)
      const tempToken = createSignedTempToken(admin.id);
      
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

/**
 * Validate a temp token and return the associated admin ID
 * Checks both the cookie and the provided token
 */
export async function validateTempToken(providedToken: string): Promise<string | null> {
  // First try the provided token
  let adminId = verifySignedTempToken(providedToken);
  if (adminId) return adminId;
  
  // Fall back to cookie (in case token wasn't passed correctly)
  try {
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(TEMP_TOKEN_COOKIE)?.value;
    if (cookieToken) {
      adminId = verifySignedTempToken(cookieToken);
    }
  } catch {
    // Ignore cookie errors
  }
  
  return adminId;
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
