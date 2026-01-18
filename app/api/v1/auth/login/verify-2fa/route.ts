import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { createSession, setSessionCookie } from '@/app/_lib/auth';
import {
  verifyTOTP,
  decryptTOTPSecret,
  verifyRecoveryCode,
  RecoveryCode,
} from '@/app/_lib/totp';
import { Prisma } from '@prisma/client';
import {
  validateTempToken,
  clearTempTokenCookie,
} from '../route';

/**
 * POST /api/v1/auth/login/verify-2fa
 * 
 * Verify TOTP code or recovery code to complete login.
 * Requires a valid temp token from password verification step.
 * 
 * Security:
 * - Requires valid temp token (5 min expiry)
 * - Accepts either TOTP code or recovery code
 * - Recovery codes are one-time use
 * - Timing-safe comparison for all verification
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tempToken, code, useRecoveryCode } = body;

    console.log('[2FA Verify] Received request');
    console.log('[2FA Verify] Has tempToken:', !!tempToken);
    console.log('[2FA Verify] Code length:', code?.length);

    // Validate temp token
    if (!tempToken || typeof tempToken !== 'string') {
      console.log('[2FA Verify] No temp token provided');
      return NextResponse.json(
        { error: 'Invalid request. Please start login again.' },
        { status: 400 }
      );
    }

    const userId = await validateTempToken(tempToken);
    console.log('[2FA Verify] User ID from token:', userId);
    
    if (!userId) {
      console.log('[2FA Verify] Token validation failed');
      return NextResponse.json(
        { error: 'Session expired. Please start login again.' },
        { status: 401 }
      );
    }

    // Validate code
    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    // Get user with 2FA data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        totpSecret: true,
        totpKeyVersion: true,
        totpEnabled: true,
        recoveryCodes: true,
      },
    });

    if (!user || !user.totpEnabled || !user.totpSecret) {
      return NextResponse.json(
        { error: '2FA not configured. Please start login again.' },
        { status: 400 }
      );
    }

    let isValid = false;

    if (useRecoveryCode) {
      // Verify recovery code
      const recoveryCodes = user.recoveryCodes as RecoveryCode[] | null;
      
      if (!recoveryCodes || recoveryCodes.length === 0) {
        return NextResponse.json(
          { error: 'No recovery codes available' },
          { status: 400 }
        );
      }

      const matchIndex = await verifyRecoveryCode(code, recoveryCodes);
      
      if (matchIndex >= 0) {
        isValid = true;
        
        // Mark recovery code as used
        recoveryCodes[matchIndex].used = true;
        
        await prisma.user.update({
          where: { id: userId },
          data: { recoveryCodes: recoveryCodes as unknown as Prisma.InputJsonValue },
        });
      }
    } else {
      // Verify TOTP code
      console.log('[2FA Verify] Verifying TOTP code:', code);
      const secret = decryptTOTPSecret(user.totpSecret, user.totpKeyVersion);
      console.log('[2FA Verify] Decrypted secret length:', secret?.length);
      isValid = verifyTOTP(secret, code);
      console.log('[2FA Verify] TOTP valid:', isValid);
    }

    if (!isValid) {
      return NextResponse.json(
        { error: useRecoveryCode ? 'Invalid recovery code' : 'Invalid verification code' },
        { status: 401 }
      );
    }

    // Clear temp token cookie
    await clearTempTokenCookie();

    // Create session and set cookie
    const sessionId = await createSession(userId);
    await setSessionCookie(sessionId);

    // Count remaining recovery codes
    const recoveryCodes = user.recoveryCodes as RecoveryCode[] | null;
    const remainingCodes = recoveryCodes?.filter(c => !c.used).length ?? 0;

    return NextResponse.json({
      success: true,
      remainingRecoveryCodes: remainingCodes,
      // Warn if running low on recovery codes
      lowRecoveryCodes: remainingCodes < 3,
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

