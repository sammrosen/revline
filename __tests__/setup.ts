/**
 * Test Setup
 * 
 * Configures the test environment with:
 * - Environment variables
 * - Database connection (test DB)
 * - Cleanup between tests
 * - Global test utilities
 * 
 * DATABASE SETUP:
 * Set TEST_DATABASE_URL in your environment before running tests:
 * 
 * Windows:
 *   set TEST_DATABASE_URL=postgresql://user:pass@host:port/testdb
 *   npm run test
 * 
 * Linux/Mac:
 *   TEST_DATABASE_URL=postgresql://user:pass@host:port/testdb npm run test
 * 
 * Or add TEST_DATABASE_URL to your .env.local file.
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

// IMPORTANT: Capture TEST_DATABASE_URL from shell FIRST before anything else
const testDbUrlFromEnv = process.env.TEST_DATABASE_URL;

// Load environment files (for local development) - but we'll override DATABASE_URL
// Don't override existing env vars (like those from CI/CD)
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: false });
dotenv.config({ path: '.env', override: false });

// Load test environment
(process.env as Record<string, string>).NODE_ENV = 'test';
process.env.REVLINE_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
// Set test Stripe API key (required for Stripe adapter initialization)
process.env.STRIPE_API_KEY = process.env.STRIPE_API_KEY || 'sk_test_fake_key_for_testing';

// Use TEST_DATABASE_URL from shell if set (takes precedence over .env files)
// This MUST happen before creating any Prisma clients
const testDbUrl = testDbUrlFromEnv || process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  console.error('ERROR: TEST_DATABASE_URL not set.');
  console.error('Set TEST_DATABASE_URL in your environment before running tests.');
  process.exit(1);
}

// Override DATABASE_URL for all Prisma operations
process.env.DATABASE_URL = testDbUrl;
console.log('Test database URL set:', testDbUrl.replace(/:[^:@]+@/, ':****@'));

// Create test Prisma client directly here (not from separate file)
// This ensures it uses the correct DATABASE_URL we just set
export const testPrisma = new PrismaClient({
  log: ['error'],
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

// Mock the db module - use our testPrisma client
vi.mock('@/app/_lib/db', () => ({
  prisma: testPrisma,
}));

// Mock Next.js headers for middleware tests
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => {
      if (key === 'x-admin-id') {
        return 'test-admin-id';
      }
      return null;
    },
  })),
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'revline_admin_session') {
        return { value: 'test-session-id' };
      }
      return undefined;
    },
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

beforeAll(async () => {
  // Run migrations on test database before connecting
  console.log('Running migrations on test database...');
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
    });
    console.log('Migrations completed');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  // Generate Prisma client to ensure it's up to date
  // Note: This may fail if client is already generated and locked - that's OK
  try {
    execSync('npx prisma generate', {
      stdio: 'pipe', // Use pipe instead of inherit to avoid noise
      env: {
        ...process.env,
        DATABASE_URL: testDbUrl,
      },
    });
  } catch {
    // Ignore - Prisma client is likely already generated
    // This is non-critical since migrations ensure schema is up to date
  }

  // Connect to test database
  await testPrisma.$connect();
  console.log('Connected to test database');
});

afterAll(async () => {
  // Disconnect from test database
  await testPrisma.$disconnect();
  console.log('Disconnected from test database');
});

afterEach(async () => {
  // Clean up test data after each test
  // Order matters due to foreign key constraints
  await testPrisma.workflowExecution.deleteMany();
  await testPrisma.workflow.deleteMany();
  await testPrisma.event.deleteMany();
  await testPrisma.lead.deleteMany();
  await testPrisma.clientIntegration.deleteMany();
  await testPrisma.adminSession.deleteMany();
  await testPrisma.admin.deleteMany();
  await testPrisma.client.deleteMany();
  
  // Reset all mocks
  vi.clearAllMocks();
});

/**
 * Test helper: Create a test client
 */
export async function createTestClient(overrides: Partial<{
  name: string;
  slug: string;
  status: 'ACTIVE' | 'PAUSED';
}> = {}) {
  return testPrisma.client.create({
    data: {
      name: overrides.name ?? 'Test Client',
      slug: overrides.slug ?? `test-client-${Date.now()}`,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

/**
 * Test helper: Create a test integration
 */
export async function createTestIntegration(
  clientId: string,
  integration: 'MAILERLITE' | 'STRIPE' | 'CALENDLY' | 'MANYCHAT',
  secret: string,
  meta?: Record<string, unknown>
) {
  // Import encryption at runtime to avoid circular deps
  const { encryptSecret } = await import('@/app/_lib/crypto');
  const { randomUUID } = await import('crypto');
  
  // Create secrets array with the new format
  const { encryptedSecret, keyVersion } = encryptSecret(secret);
  const secrets = [{
    id: randomUUID(),
    name: 'API Key',
    encryptedValue: encryptedSecret,
    keyVersion,
  }];
  
  return testPrisma.clientIntegration.create({
    data: {
      clientId,
      integration,
      secrets: secrets as Parameters<typeof testPrisma.clientIntegration.create>[0]['data']['secrets'],
      meta: meta as Parameters<typeof testPrisma.clientIntegration.create>[0]['data']['meta'],
    },
  });
}

/**
 * Test helper: Create a test lead
 */
export async function createTestLead(
  clientId: string,
  overrides: Partial<{
    email: string;
    source: string;
    stage: 'CAPTURED' | 'BOOKED' | 'PAID' | 'DEAD';
  }> = {}
) {
  return testPrisma.lead.create({
    data: {
      clientId,
      email: overrides.email ?? `test-${Date.now()}@example.com`,
      source: overrides.source ?? 'test',
      stage: overrides.stage ?? 'CAPTURED',
    },
  });
}

/**
 * Test helper: Get events for a client
 */
export async function getEventsForClient(clientId: string) {
  return testPrisma.event.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Test helper: Create a test workflow
 */
export async function createTestWorkflow(
  clientId: string,
  overrides: Partial<{
    name: string;
    enabled: boolean;
    triggerAdapter: string;
    triggerOperation: string;
    actions: Array<{ adapter: string; operation: string; params: Record<string, unknown> }>;
  }> = {}
) {
  return testPrisma.workflow.create({
    data: {
      clientId,
      name: overrides.name ?? 'Test Workflow',
      enabled: overrides.enabled ?? true,
      triggerAdapter: overrides.triggerAdapter ?? 'revline',
      triggerOperation: overrides.triggerOperation ?? 'email_captured',
      actions: (overrides.actions ?? []) as Parameters<typeof testPrisma.workflow.create>[0]['data']['actions'],
    },
  });
}

