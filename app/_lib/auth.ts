import * as argon2 from 'argon2';
import { cookies } from 'next/headers';
import { prisma } from './db';

const SESSION_COOKIE_NAME = 'srb_admin_session';
const SESSION_DURATION_DAYS = 14;

/**
 * Hash a password using Argon2id
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Create a new admin session and return the session ID
 */
export async function createSession(adminId: string): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const session = await prisma.adminSession.create({
    data: {
      adminId,
      expiresAt,
    },
  });

  return session.id;
}

/**
 * Validate a session ID and return the admin ID if valid
 * Returns null if session doesn't exist or is expired
 */
export async function validateSession(
  sessionId: string
): Promise<string | null> {
  const session = await prisma.adminSession.findUnique({
    where: { id: sessionId },
    select: {
      adminId: true,
      expiresAt: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    // Session expired - delete it
    await prisma.adminSession.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return session.adminId;
}

/**
 * Delete a session
 */
export async function destroySession(sessionId: string): Promise<void> {
  await prisma.adminSession.delete({ where: { id: sessionId } }).catch(() => {});
}

/**
 * Set the session cookie (call after successful login)
 */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

/**
 * Clear the session cookie (call on logout)
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get the session ID from the cookie
 */
export async function getSessionFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Validate the current request's session
 * Returns the admin ID if authenticated, null otherwise
 */
export async function getAuthenticatedAdmin(): Promise<string | null> {
  const sessionId = await getSessionFromCookie();
  if (!sessionId) {
    return null;
  }
  return validateSession(sessionId);
}

/**
 * Get the single admin account (for login)
 */
export async function getAdmin(): Promise<{
  id: string;
  passwordHash: string;
} | null> {
  return prisma.admin.findFirst({
    select: {
      id: true,
      passwordHash: true,
    },
  });
}

/**
 * Create the initial admin account (for setup)
 */
export async function createAdmin(password: string): Promise<string> {
  const passwordHash = await hashPassword(password);
  const admin = await prisma.admin.create({
    data: { passwordHash },
  });
  return admin.id;
}

