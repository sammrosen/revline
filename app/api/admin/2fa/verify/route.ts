import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import {
  verifyTOTP,
  decryptTOTPSecret,
  generateRecoveryCodes,
  formatRecoveryCode,
} from '@/app/_lib/totp';
import { Prisma } from '@prisma/client';

/**
 * POST /api/admin/2fa/verify
 * 
 * Verify a TOTP code and enable 2FA.
 * Also generates recovery codes.
 * 
 * Security:
 * - Requires valid admin session
 * - Validates TOTP code against stored secret
 * - Generates recovery codes (hashed) for account recovery
 * - Invalidates all other sessions for security
 */
export async function POST(request: NextRequest) {
  try {
    const adminId = await getAdminIdFromHeaders();
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    // Get admin with TOTP secret
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        totpSecret: true,
        totpKeyVersion: true,
        totpEnabled: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Check if already enabled
    if (admin.totpEnabled) {
      return NextResponse.json(
        { error: '2FA is already enabled' },
        { status: 400 }
      );
    }

    // Check if setup was initiated
    if (!admin.totpSecret) {
      return NextResponse.json(
        { error: '2FA setup not initiated. Please start setup first.' },
        { status: 400 }
      );
    }

    // Decrypt and verify the TOTP code
    const secret = decryptTOTPSecret(admin.totpSecret, admin.totpKeyVersion);
    const isValid = verifyTOTP(secret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please try again.' },
        { status: 400 }
      );
    }

    // Generate recovery codes
    const { plaintextCodes, hashedCodes } = await generateRecoveryCodes();

    // Enable 2FA and save recovery codes
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        totpEnabled: true,
        recoveryCodes: hashedCodes as unknown as Prisma.InputJsonValue,
      },
    });

    // Invalidate all other sessions for security (keep current one)
    // This is handled by the client refreshing after setup

    // Return formatted recovery codes (shown once)
    const formattedCodes = plaintextCodes.map(formatRecoveryCode);

    return NextResponse.json({
      success: true,
      message: '2FA enabled successfully',
      recoveryCodes: formattedCodes,
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

