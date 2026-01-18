import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders, verifyPassword } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { generateRecoveryCodes, formatRecoveryCode } from '@/app/_lib/totp';
import { Prisma } from '@prisma/client';

/**
 * POST /api/v1/auth/2fa/regenerate
 * 
 * Regenerate recovery codes.
 * Invalidates all existing recovery codes.
 * Requires password confirmation for security.
 * 
 * Security:
 * - Requires valid admin session
 * - Requires password confirmation
 * - Invalidates all old recovery codes
 */
export async function POST(request: NextRequest) {
  try {
    const adminId = await getAdminIdFromHeaders();
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required to regenerate recovery codes' },
        { status: 400 }
      );
    }

    // Get admin
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        passwordHash: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Check if 2FA is enabled
    if (!user.totpEnabled) {
      return NextResponse.json(
        { error: '2FA must be enabled to regenerate recovery codes' },
        { status: 400 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Generate new recovery codes
    const { plaintextCodes, hashedCodes } = await generateRecoveryCodes();

    // Save new recovery codes (invalidates all old ones)
    await prisma.user.update({
      where: { id: adminId },
      data: {
        recoveryCodes: hashedCodes as unknown as Prisma.InputJsonValue,
      },
    });

    // Return formatted recovery codes (shown once)
    const formattedCodes = plaintextCodes.map(formatRecoveryCode);

    return NextResponse.json({
      success: true,
      message: 'Recovery codes regenerated. Old codes are now invalid.',
      recoveryCodes: formattedCodes,
    });
  } catch (error) {
    console.error('2FA regenerate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

