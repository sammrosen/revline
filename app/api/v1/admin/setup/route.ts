import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { hashPassword, createSession, setSessionCookie } from '@/app/_lib/auth';
import { validatePasswordComplexity } from '@/app/_lib/totp';
import { Prisma } from '@prisma/client';

/**
 * POST /api/v1/admin/setup
 * 
 * First-time admin password setup.
 * Only works when no admin exists in the database.
 * 
 * Security:
 * - Requires SETUP_CODE from form to match env var (if set)
 * - Returns 404 if admin already exists (no enumeration)
 * - Validates password complexity
 */
export async function POST(request: NextRequest) {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.admin.findFirst();
    
    if (existingAdmin) {
      // Return 404 to prevent enumeration
      return NextResponse.json(
        { error: 'Not Found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { password, confirmPassword, setupCode: providedCode } = body;

    // Check setup code if configured
    const setupCode = process.env.SETUP_CODE;
    
    if (setupCode && setupCode !== providedCode) {
      return NextResponse.json(
        { error: 'Invalid setup code' },
        { status: 401 }
      );
    }

    // Validate input
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate password complexity
    const { valid, errors } = validatePasswordComplexity(password);
    if (!valid) {
      return NextResponse.json(
        { error: errors[0], errors },
        { status: 400 }
      );
    }

    // Hash password and create admin
    const passwordHash = await hashPassword(password);
    
    const admin = await prisma.admin.create({
      data: {
        passwordHash,
        totpEnabled: false,
        totpSecret: null,
        recoveryCodes: Prisma.DbNull,
      },
    });

    // Create session and log in automatically
    const sessionId = await createSession(admin.id);
    await setSessionCookie(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Admin account created successfully',
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/admin/setup
 * 
 * Check if setup is required (no admin exists)
 * Also tells the client if a setup code is required
 */
export async function GET() {
  try {
    const existingAdmin = await prisma.admin.findFirst();
    
    if (existingAdmin) {
      // Return 404 to prevent enumeration
      return NextResponse.json(
        { error: 'Not Found' },
        { status: 404 }
      );
    }

    // Tell client if setup code is required (without revealing the code)
    const requiresSetupCode = !!process.env.SETUP_CODE;

    return NextResponse.json({
      setupRequired: true,
      requiresSetupCode,
    });
  } catch (error) {
    console.error('Setup check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

