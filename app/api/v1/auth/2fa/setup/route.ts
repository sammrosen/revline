import { NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import {
  generateTOTPSecret,
  generateTOTPUri,
  encryptTOTPSecret,
} from '@/app/_lib/totp';

/**
 * POST /api/v1/auth/2fa/setup
 * 
 * Generate a new TOTP secret for 2FA setup.
 * Returns the secret and QR code URI.
 * Does NOT enable 2FA - that requires verification first.
 * 
 * Security:
 * - Requires valid admin session
 * - Secret is encrypted before storage
 * - Only generates secret, doesn't enable until verified
 */
export async function POST() {
  try {
    const adminId = await getAdminIdFromHeaders();
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current admin
    const user = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, totpEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Check if 2FA is already enabled
    if (user.totpEnabled) {
      return NextResponse.json(
        { error: '2FA is already enabled. Disable it first to set up again.' },
        { status: 400 }
      );
    }

    // Generate new TOTP secret
    const secret = generateTOTPSecret();
    
    // Generate QR code URI
    const uri = generateTOTPUri(secret, 'admin@revline');

    // Encrypt and store the secret temporarily
    // We store it now but mark totpEnabled as false until verified
    const { encryptedSecret, keyVersion } = encryptTOTPSecret(secret);

    await prisma.user.update({
      where: { id: adminId },
      data: {
        totpSecret: encryptedSecret,
        totpKeyVersion: keyVersion,
        totpEnabled: false, // Not enabled until verified
      },
    });

    return NextResponse.json({
      success: true,
      secret, // Plaintext secret for manual entry
      uri, // For QR code generation
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

