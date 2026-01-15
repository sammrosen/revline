import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders, verifyPassword } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { Prisma } from '@prisma/client';

/**
 * POST /api/v1/admin/2fa/disable
 * 
 * Disable 2FA for the admin account.
 * Requires password confirmation for security.
 * 
 * Security:
 * - Requires valid admin session
 * - Requires password confirmation
 * - Clears TOTP secret and recovery codes
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
        { error: 'Password is required to disable 2FA' },
        { status: 400 }
      );
    }

    // Get admin
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        passwordHash: true,
        totpEnabled: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Check if 2FA is enabled
    if (!admin.totpEnabled) {
      return NextResponse.json(
        { error: '2FA is not enabled' },
        { status: 400 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, admin.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Disable 2FA
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        recoveryCodes: Prisma.DbNull,
      },
    });

    return NextResponse.json({
      success: true,
      message: '2FA has been disabled',
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

