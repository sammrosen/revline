import { NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { countUnusedRecoveryCodes, RecoveryCode } from '@/app/_lib/totp';

/**
 * GET /api/admin/2fa/status
 * 
 * Get current 2FA status for the authenticated admin.
 */
export async function GET() {
  try {
    const adminId = await getAdminIdFromHeaders();
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        totpEnabled: true,
        recoveryCodes: true,
      },
    });

    if (!admin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const recoveryCodes = admin.recoveryCodes as RecoveryCode[] | null;
    const unusedCodesCount = recoveryCodes ? countUnusedRecoveryCodes(recoveryCodes) : 0;
    const totalCodesCount = recoveryCodes?.length ?? 0;

    return NextResponse.json({
      totpEnabled: admin.totpEnabled,
      recoveryCodesRemaining: unusedCodesCount,
      recoveryCodesTotal: totalCodesCount,
      lowRecoveryCodes: unusedCodesCount < 3 && admin.totpEnabled,
    });
  } catch (error) {
    console.error('2FA status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

