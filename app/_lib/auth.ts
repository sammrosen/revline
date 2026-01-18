import * as argon2 from 'argon2';
import { cookies } from 'next/headers';
import { prisma } from './db';

const SESSION_COOKIE_NAME = 'revline_session';
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
 * Create a new user session and return the session ID
 */
export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  });

  return session.id;
}

/**
 * Validate a session ID and return the user ID if valid
 * Returns null if session doesn't exist or is expired
 */
export async function validateSession(
  sessionId: string
): Promise<string | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      expiresAt: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    // Session expired - delete it
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return session.userId;
}

/**
 * Delete a session
 */
export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
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
 * Returns the user ID if authenticated, null otherwise
 */
export async function getAuthenticatedUser(): Promise<string | null> {
  const sessionId = await getSessionFromCookie();
  if (!sessionId) {
    return null;
  }
  return validateSession(sessionId);
}

/**
 * Get a user by email (for login)
 */
export async function getUserByEmail(email: string): Promise<{
  id: string;
  email: string;
  name: string | null;
  passwordHash: string;
  totpEnabled: boolean;
} | null> {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      totpEnabled: true,
    },
  });
}

/**
 * Get the first user (for legacy single-user login flow)
 * TODO: Remove once email-based login UI is implemented
 */
export async function getUser(): Promise<{
  id: string;
  email: string;
  passwordHash: string;
  totpEnabled: boolean;
} | null> {
  return prisma.user.findFirst({
    select: {
      id: true,
      email: true,
      passwordHash: true,
      totpEnabled: true,
    },
  });
}

/**
 * Create a new user account (for setup)
 */
export async function createUser(
  email: string,
  password: string,
  name?: string
): Promise<string> {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { 
      email: email.toLowerCase(),
      name,
      passwordHash,
    },
  });
  return user.id;
}

/**
 * Check if any users exist (for setup page gate)
 */
export async function hasUsers(): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}

/**
 * Get user ID from middleware headers
 * Used in server components after middleware has validated the session
 * Returns null if not set (should not happen if middleware is working correctly)
 */
export async function getUserIdFromHeaders(): Promise<string | null> {
  const { headers } = await import('next/headers');
  const headersList = await headers();
  return headersList.get('x-user-id');
}

// =============================================================================
// LEGACY ALIASES (for backward compatibility during migration)
// TODO: Remove these once all code is updated
// =============================================================================

/** @deprecated Use getAuthenticatedUser instead */
export const getAuthenticatedAdmin = getAuthenticatedUser;

/** @deprecated Use getUser instead */
export const getAdmin = getUser;

/** @deprecated Use createUser instead */
export async function createAdmin(password: string): Promise<string> {
  // Legacy function - creates user with placeholder email
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { 
      email: `admin-${Date.now()}@placeholder.local`,
      passwordHash,
    },
  });
  return user.id;
}

/** @deprecated Use getUserIdFromHeaders instead */
export const getAdminIdFromHeaders = getUserIdFromHeaders;
