/**
 * Test Setup
 * 
 * Configures the test environment with:
 * - Environment variables
 * - Worker-specific database connection (for parallel execution)
 * - Cleanup between tests
 * - Global test utilities
 * 
 * PARALLEL TEST EXECUTION:
 * Each Vitest worker gets its own isolated database (test_db_0, test_db_1, etc.)
 * Databases are created by globalSetup.ts and dropped by globalTeardown.ts
 * 
 * DATABASE SETUP:
 * Set TEST_DATABASE_URL in your environment or .env.local file.
 * The globalSetup will create worker-specific databases from this base URL.
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';

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

// Get base database URL
const baseDbUrl = testDbUrlFromEnv || process.env.TEST_DATABASE_URL;
if (!baseDbUrl) {
  console.error('ERROR: TEST_DATABASE_URL not set.');
  console.error('Set TEST_DATABASE_URL in your environment or .env.local file.');
  process.exit(1);
}

// Get worker ID for parallel execution (each worker gets its own database)
// VITEST_POOL_ID is set by Vitest for each worker, but can exceed maxThreads
// when workers are recycled, so we use modulo to stay within bounds
const rawWorkerId = parseInt(process.env.VITEST_POOL_ID || '0', 10);
const numWorkers = parseInt(process.env.VITEST_MAX_THREADS || '4', 10);
const workerId = rawWorkerId % numWorkers;

// Build worker-specific database URL
// Replaces the database name in the URL with test_db_{workerId}
const testDbUrl = baseDbUrl.replace(/\/([^/?]+)(\?|$)/, `/test_db_${workerId}$2`);

// Override DATABASE_URL for all Prisma operations
process.env.DATABASE_URL = testDbUrl;
console.log(`Worker ${workerId} using database:`, testDbUrl.replace(/:[^:@]+@/, ':****@'));

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
      if (key === 'x-user-id') {
        return 'test-user-id';
      }
      return null;
    },
  })),
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === 'revline_session') {
        return { value: 'test-session-id' };
      }
      return undefined;
    },
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

beforeAll(async () => {
  // Connect to test database
  // Note: Migrations are handled by globalSetup.ts before any tests run
  await testPrisma.$connect();
  console.log(`Worker ${workerId} connected to test database`);
});

afterAll(async () => {
  // Disconnect from test database
  await testPrisma.$disconnect();
  console.log(`Worker ${workerId} disconnected from test database`);
});

afterEach(async () => {
  // Clean up test data after each test
  // Order matters due to foreign key constraints (children before parents)
  // Agent tables wrapped in try/catch for resilience during migration transitions
  try {
    await testPrisma.conversationMessage.deleteMany();
    await testPrisma.agentFile.deleteMany();
    await testPrisma.optOutRecord.deleteMany();
    await testPrisma.conversation.deleteMany();
    await testPrisma.agent.deleteMany();
  } catch {
    // Tables may not exist yet if migration hasn't been applied to this test DB
  }
  await testPrisma.idempotencyKey.deleteMany();
  await testPrisma.webhookEvent.deleteMany();
  await testPrisma.workflowExecution.deleteMany();
  await testPrisma.workflow.deleteMany();
  await testPrisma.event.deleteMany();
  await testPrisma.lead.deleteMany();
  await testPrisma.pendingBooking.deleteMany();
  await testPrisma.workspaceIntegration.deleteMany();
  await testPrisma.session.deleteMany();
  await testPrisma.workspaceMember.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.workspace.deleteMany();
  
  // Reset all mocks
  vi.clearAllMocks();
});

/**
 * Test helper: Create a test workspace
 */
export async function createTestWorkspace(overrides: Partial<{
  name: string;
  slug: string;
  status: 'ACTIVE' | 'PAUSED';
}> = {}) {
  return testPrisma.workspace.create({
    data: {
      name: overrides.name ?? 'Test Workspace',
      slug: overrides.slug ?? `test-workspace-${Date.now()}`,
      status: overrides.status ?? 'ACTIVE',
    },
  });
}

/**
 * Legacy alias for backwards compatibility
 */
export const createTestClient = createTestWorkspace;

/**
 * Test helper: Create a test integration
 */
export async function createTestIntegration(
  workspaceId: string,
  integration: 'MAILERLITE' | 'STRIPE' | 'CALENDLY' | 'MANYCHAT' | 'ABC_IGNITE' | 'REVLINE' | 'RESEND' | 'TWILIO' | 'OPENAI' | 'ANTHROPIC',
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
  
  return testPrisma.workspaceIntegration.create({
    data: {
      workspaceId,
      integration,
      secrets: secrets as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['secrets'],
      meta: meta as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['meta'],
    },
  });
}

/**
 * Test helper: Create ABC Ignite integration with multi-secret support
 * ABC Ignite requires both App ID and App Key secrets
 */
export async function createAbcIgniteIntegration(
  workspaceId: string,
  appId: string,
  appKey: string,
  meta?: {
    clubNumber: string;
    defaultEventTypeId?: string;
    defaultEmployeeId?: string;
    eventTypes?: Record<string, { id: string; name: string; category: string; duration?: number; levelId?: string }>;
    employees?: Record<string, { id: string; name: string; title?: string }>;
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
  
  return testPrisma.workspaceIntegration.create({
    data: {
      workspaceId,
      integration: 'ABC_IGNITE',
      secrets: secrets as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['secrets'],
      meta: meta as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['meta'],
    },
  });
}

/**
 * Test helper: Create Resend integration
 * Resend requires API Key secret and fromEmail in meta
 */
export async function createResendIntegration(
  workspaceId: string,
  apiKey: string,
  meta?: {
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
  }
) {
  const { encryptSecret } = await import('@/app/_lib/crypto');
  const { randomUUID } = await import('crypto');
  
  const apiKeyEncrypted = encryptSecret(apiKey);
  
  const secrets = [
    {
      id: randomUUID(),
      name: 'API Key',
      encryptedValue: apiKeyEncrypted.encryptedSecret,
      keyVersion: apiKeyEncrypted.keyVersion,
    },
  ];
  
  return testPrisma.workspaceIntegration.create({
    data: {
      workspaceId,
      integration: 'RESEND',
      secrets: secrets as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['secrets'],
      meta: meta as Parameters<typeof testPrisma.workspaceIntegration.create>[0]['data']['meta'],
    },
  });
}

/**
 * Test helper: Create a test lead
 */
export async function createTestLead(
  workspaceId: string,
  overrides: Partial<{
    email: string;
    source: string;
    stage: 'CAPTURED' | 'BOOKED' | 'PAID' | 'DEAD';
  }> = {}
) {
  return testPrisma.lead.create({
    data: {
      workspaceId,
      email: overrides.email ?? `test-${Date.now()}@example.com`,
      source: overrides.source ?? 'test',
      stage: overrides.stage ?? 'CAPTURED',
    },
  });
}

/**
 * Test helper: Get events for a workspace
 */
export async function getEventsForWorkspace(workspaceId: string) {
  return testPrisma.event.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Legacy alias for backwards compatibility
 */
export const getEventsForClient = getEventsForWorkspace;

/**
 * Test helper: Create a test workflow
 * Note: Defaults to enabled: false to match production behavior
 * (workflows start disabled and must be explicitly enabled)
 */
export async function createTestWorkflow(
  workspaceId: string,
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
      workspaceId,
      name: overrides.name ?? 'Test Workflow',
      enabled: overrides.enabled ?? false, // Default to disabled - must be explicitly enabled
      triggerAdapter: overrides.triggerAdapter ?? 'revline',
      triggerOperation: overrides.triggerOperation ?? 'contact-submitted',
      actions: (overrides.actions ?? []) as Parameters<typeof testPrisma.workflow.create>[0]['data']['actions'],
    },
  });
}

/**
 * Test helper: Create a test webhook event
 */
export async function createTestWebhookEvent(
  workspaceId: string,
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
      workspaceId,
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
  workspaceId: string,
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
      workspaceId,
      key: overrides.key ?? `test-key-${Date.now()}`,
      status: overrides.status ?? 'PENDING',
      result: overrides.result as Parameters<typeof testPrisma.idempotencyKey.create>[0]['data']['result'],
      error: overrides.error,
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

/**
 * Test helper: Cleanup all test data
 * 
 * Can be called explicitly in beforeEach/afterEach if needed.
 * Note: afterEach already calls this automatically.
 */
export async function cleanupTestData() {
  // Order matters due to foreign key constraints (children before parents)
  try {
    await testPrisma.conversationMessage.deleteMany();
    await testPrisma.agentFile.deleteMany();
    await testPrisma.optOutRecord.deleteMany();
    await testPrisma.conversation.deleteMany();
    await testPrisma.agent.deleteMany();
  } catch {
    // Tables may not exist yet if migration hasn't been applied to this test DB
  }
  await testPrisma.idempotencyKey.deleteMany();
  await testPrisma.webhookEvent.deleteMany();
  await testPrisma.workflowExecution.deleteMany();
  await testPrisma.workflow.deleteMany();
  await testPrisma.event.deleteMany();
  await testPrisma.lead.deleteMany();
  await testPrisma.pendingBooking.deleteMany();
  await testPrisma.workspaceIntegration.deleteMany();
  await testPrisma.session.deleteMany();
  await testPrisma.workspaceMember.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.workspace.deleteMany();
}

/**
 * Test helper: Create a test agent
 */
export async function createTestAgent(
  workspaceId: string,
  overrides: Partial<{
    name: string;
    aiIntegration: string;
    systemPrompt: string;
    channelType: string;
    channelIntegration: string;
    channelAddress: string;
    initialMessage: string;
    modelOverride: string;
    temperatureOverride: number;
    maxTokensOverride: number;
    maxMessagesPerConversation: number;
    maxTokensPerConversation: number;
    conversationTimeoutMinutes: number;
    responseDelaySeconds: number;
    autoResumeMinutes: number;
    rateLimitPerHour: number;
    fallbackMessage: string;
    escalationPattern: string;
    faqOverrides: Array<{ patterns: string[]; response: string }>;
    allowedEvents: string[];
    enabledTools: string[];
    active: boolean;
  }> = {}
) {
  return testPrisma.agent.create({
    data: {
      workspaceId,
      name: overrides.name ?? 'Test Agent',
      aiIntegration: overrides.aiIntegration ?? 'OPENAI',
      systemPrompt: overrides.systemPrompt ?? 'You are a helpful assistant.',
      channelType: overrides.channelType ?? null,
      channelIntegration: overrides.channelIntegration ?? null,
      channelAddress: overrides.channelAddress ?? null,
      initialMessage: overrides.initialMessage ?? null,
      modelOverride: overrides.modelOverride ?? null,
      temperatureOverride: overrides.temperatureOverride ?? null,
      maxTokensOverride: overrides.maxTokensOverride ?? null,
      maxMessagesPerConversation: overrides.maxMessagesPerConversation ?? 50,
      maxTokensPerConversation: overrides.maxTokensPerConversation ?? 100000,
      conversationTimeoutMinutes: overrides.conversationTimeoutMinutes ?? 1440,
      responseDelaySeconds: overrides.responseDelaySeconds ?? 0,
      autoResumeMinutes: overrides.autoResumeMinutes ?? 60,
      rateLimitPerHour: overrides.rateLimitPerHour ?? 10,
      fallbackMessage: overrides.fallbackMessage ?? null,
      escalationPattern: overrides.escalationPattern ?? null,
      faqOverrides: overrides.faqOverrides as Parameters<typeof testPrisma.agent.create>[0]['data']['faqOverrides'],
      allowedEvents: (overrides.allowedEvents ?? []) as Parameters<typeof testPrisma.agent.create>[0]['data']['allowedEvents'],
      enabledTools: (overrides.enabledTools ?? []) as Parameters<typeof testPrisma.agent.create>[0]['data']['enabledTools'],
      active: overrides.active ?? true,
    },
  });
}

/**
 * Test helper: Create a test conversation
 */
export async function createTestConversation(
  workspaceId: string,
  agentId: string,
  overrides: Partial<{
    leadId: string;
    channel: string;
    contactAddress: string;
    channelAddress: string;
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ESCALATED' | 'TIMED_OUT';
    messageCount: number;
    totalTokens: number;
    isTest: boolean;
    pausedAt: Date;
    pausedBy: string;
    startedAt: Date;
    lastMessageAt: Date;
    endedAt: Date;
  }> = {}
) {
  return testPrisma.conversation.create({
    data: {
      workspaceId,
      agentId,
      leadId: overrides.leadId ?? null,
      channel: overrides.channel ?? 'SMS',
      contactAddress: overrides.contactAddress ?? '+15551234567',
      channelAddress: overrides.channelAddress ?? '+15559876543',
      status: overrides.status ?? 'ACTIVE',
      messageCount: overrides.messageCount ?? 0,
      totalTokens: overrides.totalTokens ?? 0,
      isTest: overrides.isTest ?? true,
      pausedAt: overrides.pausedAt ?? null,
      pausedBy: overrides.pausedBy ?? null,
      startedAt: overrides.startedAt ?? new Date(),
      lastMessageAt: overrides.lastMessageAt ?? null,
      endedAt: overrides.endedAt ?? null,
    },
  });
}

