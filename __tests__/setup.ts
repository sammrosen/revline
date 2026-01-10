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

// Mock Pushover to prevent real notifications during tests
// This is important - without this mock, tests will send real push notifications
// to your phone if PUSHOVER_USER_KEY and PUSHOVER_APP_TOKEN are set!
vi.mock('@/app/_lib/pushover', () => ({
  isPushoverConfigured: () => true, // Pretend it's configured so alert code paths run
  sendPushoverNotification: async (options: { title?: string; message: string }) => {
    // Log to console so you can see alerts fired during tests
    console.log(`[TEST] Pushover notification suppressed: ${options.title || 'Alert'}`);
    return { success: true, requestId: 'test-mock-request-id' };
  },
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
  await testPrisma.idempotencyKey.deleteMany();
  await testPrisma.webhookEvent.deleteMany();
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
  integration: 'MAILERLITE' | 'STRIPE' | 'CALENDLY' | 'MANYCHAT' | 'ABC_IGNITE',
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
 * Test helper: Create ABC Ignite integration with multi-secret support
 * ABC Ignite requires both App ID and App Key secrets
 */
export async function createAbcIgniteIntegration(
  clientId: string,
  appId: string,
  appKey: string,
  meta?: {
    clubNumber: string;
    defaultEventTypeId?: string;
    eventTypes?: Record<string, { id: string; name: string; category: string; duration?: number }>;
  }
) {
  const { encryptSecret } = await import('@/app/_lib/crypto');
  const { randomUUID } = await import('crypto');
  
  // Create both required secrets
  const appIdEncrypted = encryptSecret(appId);
  const appKeyEncrypted = encryptSecret(appKey);
  
  const secrets = [
    {
      id: randomUUID(),
      name: 'App ID',
      encryptedValue: appIdEncrypted.encryptedSecret,
      keyVersion: appIdEncrypted.keyVersion,
    },
    {
      id: randomUUID(),
      name: 'App Key',
      encryptedValue: appKeyEncrypted.encryptedSecret,
      keyVersion: appKeyEncrypted.keyVersion,
    },
  ];
  
  return testPrisma.clientIntegration.create({
    data: {
      clientId,
      integration: 'ABC_IGNITE',
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

/**
 * Test helper: Create a test webhook event
 */
export async function createTestWebhookEvent(
  clientId: string,
  overrides: Partial<{
    provider: 'stripe' | 'calendly' | 'revline';
    providerEventId: string;
    rawBody: string;
    rawHeaders: Record<string, string>;
    parsedPayload: Record<string, unknown>;
    status: 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
    error: string;
  }> = {}
) {
  const { randomUUID } = await import('crypto');
  
  return testPrisma.webhookEvent.create({
    data: {
      clientId,
      correlationId: randomUUID(),
      provider: overrides.provider ?? 'stripe',
      providerEventId: overrides.providerEventId ?? `evt_test_${Date.now()}`,
      rawBody: overrides.rawBody ?? '{"test": true}',
      rawHeaders: overrides.rawHeaders as Parameters<typeof testPrisma.webhookEvent.create>[0]['data']['rawHeaders'],
      parsedPayload: overrides.parsedPayload as Parameters<typeof testPrisma.webhookEvent.create>[0]['data']['parsedPayload'],
      status: overrides.status ?? 'PENDING',
      error: overrides.error,
    },
  });
}

/**
 * Test helper: Create a test idempotency key
 */
export async function createTestIdempotencyKey(
  clientId: string,
  overrides: Partial<{
    key: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    result: Record<string, unknown>;
    error: string;
    expiresAt: Date;
  }> = {}
) {
  return testPrisma.idempotencyKey.create({
    data: {
      clientId,
      key: overrides.key ?? `test-key-${Date.now()}`,
      status: overrides.status ?? 'PENDING',
      result: overrides.result as Parameters<typeof testPrisma.idempotencyKey.create>[0]['data']['result'],
      error: overrides.error,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

