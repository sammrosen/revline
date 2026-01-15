import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { decryptSecret } from '@/app/_lib/crypto';
import { MailerLiteMeta, isMailerLiteMeta, IntegrationSecret } from '@/app/_lib/types';

type TestStatus = 'PASS' | 'WARN' | 'FAIL';
type TestCategory = 'configuration' | 'api_connectivity';

interface TestResult {
  category: TestCategory;
  name: string;
  status: TestStatus;
  message: string;
  duration: number;
}

interface HealthCheckResponse {
  clientId: string;
  clientName: string;
  clientSlug: string;
  timestamp: string;
  overallStatus: TestStatus;
  duration: number;
  tests: TestResult[];
}

// Timeout wrapper for tests
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]);
}

// Configuration Tests
async function testClientExists(clientId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    const duration = Date.now() - start;
    
    if (!client) {
      return {
        category: 'configuration',
        name: 'Client Exists',
        status: 'FAIL',
        message: 'Client not found',
        duration,
      };
    }
    
    return {
      category: 'configuration',
      name: 'Client Exists',
      status: 'PASS',
      message: 'Client found',
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'configuration',
      name: 'Client Exists',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testClientActive(clientId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    const duration = Date.now() - start;
    
    if (!client) {
      return {
        category: 'configuration',
        name: 'Client Active',
        status: 'FAIL',
        message: 'Client not found',
        duration,
      };
    }
    
    if (client.status !== 'ACTIVE') {
      return {
        category: 'configuration',
        name: 'Client Active',
        status: 'FAIL',
        message: `Client is ${client.status}`,
        duration,
      };
    }
    
    return {
      category: 'configuration',
      name: 'Client Active',
      status: 'PASS',
      message: 'Client status is ACTIVE',
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'configuration',
      name: 'Client Active',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testMailerLiteIntegrationExists(clientId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const mlIntegration = await prisma.clientIntegration.findFirst({
      where: { clientId, integration: 'MAILERLITE' },
    });
    const duration = Date.now() - start;
    
    if (!mlIntegration) {
      return {
        category: 'configuration',
        name: 'MailerLite Integration',
        status: 'FAIL',
        message: 'MailerLite not configured',
        duration,
      };
    }
    
    return {
      category: 'configuration',
      name: 'MailerLite Integration',
      status: 'PASS',
      message: 'MailerLite integration found',
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'configuration',
      name: 'MailerLite Integration',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testMailerLiteMetaValid(clientId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const mlIntegration = await prisma.clientIntegration.findFirst({
      where: { clientId, integration: 'MAILERLITE' },
    });
    const duration = Date.now() - start;
    
    if (!mlIntegration) {
      return {
        category: 'configuration',
        name: 'MailerLite Config',
        status: 'FAIL',
        message: 'Integration not found',
        duration,
      };
    }
    
    const meta = mlIntegration.meta as MailerLiteMeta | null;
    
    // Check for new format (groups + routing)
    if (!meta || !isMailerLiteMeta(meta)) {
      return {
        category: 'configuration',
        name: 'MailerLite Config',
        status: 'WARN',
        message: 'No groups configured',
        duration,
      };
    }
    
    // Check groups
    const groupCount = Object.keys(meta.groups).length;
    if (groupCount === 0) {
      return {
        category: 'configuration',
        name: 'MailerLite Config',
        status: 'WARN',
        message: 'No groups defined (configure groups, then set up workflows to use them)',
        duration,
      };
    }
    
    return {
      category: 'configuration',
      name: 'MailerLite Config',
      status: 'PASS',
      message: `${groupCount} group(s) configured`,
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'configuration',
      name: 'MailerLite Config',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testStripeIntegrationExists(clientId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const stripeIntegration = await prisma.clientIntegration.findFirst({
      where: { clientId, integration: 'STRIPE' },
    });
    const duration = Date.now() - start;
    
    if (!stripeIntegration) {
      return {
        category: 'configuration',
        name: 'Stripe Integration',
        status: 'WARN',
        message: 'Stripe not configured (optional)',
        duration,
      };
    }
    
    return {
      category: 'configuration',
      name: 'Stripe Integration',
      status: 'PASS',
      message: 'Stripe integration found',
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'configuration',
      name: 'Stripe Integration',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testRecentActivity(clientId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEvents = await prisma.event.findMany({
      where: {
        clientId,
        createdAt: { gte: sevenDaysAgo },
      },
      take: 1,
    });
    const duration = Date.now() - start;
    
    if (recentEvents.length === 0) {
      return {
        category: 'configuration',
        name: 'Recent Activity',
        status: 'WARN',
        message: 'No events in last 7 days (low traffic or new client)',
        duration,
      };
    }
    
    return {
      category: 'configuration',
      name: 'Recent Activity',
      status: 'PASS',
      message: 'Recent activity detected',
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'configuration',
      name: 'Recent Activity',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

// API Connectivity Tests
async function testMailerLiteAPI(clientId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const mlIntegration = await prisma.clientIntegration.findFirst({
      where: { clientId, integration: 'MAILERLITE' },
      select: {
        secrets: true,
        meta: true,
      },
    });
    
    if (!mlIntegration) {
      return {
        category: 'api_connectivity',
        name: 'MailerLite API',
        status: 'FAIL',
        message: 'Integration not configured',
        duration: Date.now() - start,
      };
    }
    
    // Parse secrets and get API key
    const secrets = (mlIntegration.secrets as IntegrationSecret[] | null) || [];
    if (secrets.length === 0) {
      return {
        category: 'api_connectivity',
        name: 'MailerLite API',
        status: 'FAIL',
        message: 'No API key configured',
        duration: Date.now() - start,
      };
    }
    
    const apiKeySecret = secrets.find(s => s.name === 'API Key') || secrets[0];
    const apiKey = decryptSecret(apiKeySecret.encryptedValue, apiKeySecret.keyVersion);
    
    const response = await withTimeout(
      fetch('https://connect.mailerlite.com/api/groups', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }),
      5000,
      'MailerLite API timeout'
    );
    
    if (!response.ok) {
      return {
        category: 'api_connectivity',
        name: 'MailerLite API',
        status: 'FAIL',
        message: `MailerLite API returned ${response.status} - check API key`,
        duration: Date.now() - start,
      };
    }
    
    const data = await response.json() as { data?: Array<{ id: string; name: string }> };
    const groups = data.data || [];
    const meta = mlIntegration.meta as MailerLiteMeta | null;
    
    // Verify configured groups exist in MailerLite
    if (meta && isMailerLiteMeta(meta) && meta.groups) {
      const missingGroups: string[] = [];
      const foundGroups: string[] = [];
      
      for (const [key, group] of Object.entries(meta.groups)) {
        const exists = groups.some((g) => g.id === group.id);
        if (exists) {
          foundGroups.push(key);
        } else {
          missingGroups.push(`${key} (${group.id})`);
        }
      }
      
      if (missingGroups.length > 0) {
        return {
          category: 'api_connectivity',
          name: 'MailerLite API',
          status: 'WARN',
          message: `Connected. Missing groups: ${missingGroups.join(', ')}`,
          duration: Date.now() - start,
        };
      }
      
      return {
        category: 'api_connectivity',
        name: 'MailerLite API',
        status: 'PASS',
        message: `Connected. Verified ${foundGroups.length} group(s): ${foundGroups.join(', ')}`,
        duration: Date.now() - start,
      };
    }
    
    return {
      category: 'api_connectivity',
      name: 'MailerLite API',
      status: 'PASS',
      message: `Connected successfully. Found ${groups.length} groups`,
      duration: Date.now() - start,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'api_connectivity',
      name: 'MailerLite API',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testLandingPage(clientSlug: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const landingPageUrl = `${baseUrl}/${clientSlug}`;
    
    const response = await withTimeout(
      fetch(landingPageUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'HealthCheck/1.0' },
      }),
      5000,
      'Landing page timeout'
    );
    
    if (!response.ok) {
      return {
        category: 'api_connectivity',
        name: 'Landing Page',
        status: 'FAIL',
        message: `Landing page returned ${response.status}`,
        duration: Date.now() - start,
      };
    }
    
    // Check for EmailCapture component
    const html = await response.text();
    const hasEmailCapture = html.includes('EmailCapture') || html.includes('email-capture');
    const hasSourceProp = html.includes(`source="${clientSlug}"`);
    
    if (!hasEmailCapture) {
      return {
        category: 'api_connectivity',
        name: 'Landing Page',
        status: 'WARN',
        message: 'Page loads but email capture component not detected',
        duration: Date.now() - start,
      };
    }
    
    if (!hasSourceProp) {
      return {
        category: 'api_connectivity',
        name: 'Landing Page',
        status: 'WARN',
        message: 'Page loads but source prop not found (check EmailCapture component)',
        duration: Date.now() - start,
      };
    }
    
    return {
      category: 'api_connectivity',
      name: 'Landing Page',
      status: 'PASS',
      message: 'Landing page loads correctly with email capture',
      duration: Date.now() - start,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'api_connectivity',
      name: 'Landing Page',
      status: 'FAIL',
      message: `Cannot reach landing page: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testStripeWebhook(clientSlug: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/stripe-webhook?source=${clientSlug}`;
    
    const response = await withTimeout(
      fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': 'invalid_signature_for_test',
        },
        body: JSON.stringify({ test: true }),
      }),
      5000,
      'Stripe webhook timeout'
    );
    
    // We expect 401 (invalid signature) - proves endpoint is alive
    if (response.status === 401) {
      return {
        category: 'api_connectivity',
        name: 'Stripe Webhook',
        status: 'PASS',
        message: 'Webhook endpoint responds correctly',
        duration: Date.now() - start,
      };
    }
    
    if (response.status === 404) {
      return {
        category: 'api_connectivity',
        name: 'Stripe Webhook',
        status: 'FAIL',
        message: 'Webhook endpoint not found',
        duration: Date.now() - start,
      };
    }
    
    return {
      category: 'api_connectivity',
      name: 'Stripe Webhook',
      status: 'WARN',
      message: `Unexpected response: ${response.status}`,
      duration: Date.now() - start,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'api_connectivity',
      name: 'Stripe Webhook',
      status: 'FAIL',
      message: `Cannot reach webhook: ${message}`,
      duration: Date.now() - start,
    };
  }
}

// Main health check handler
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const overallStart = Date.now();
  
  // Check admin authentication
  // Middleware handles auth - if we reach here, user is authenticated
  const adminId = await getAdminIdFromHeaders();
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { id: clientId } = await params;
  
  // Get client info
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, slug: true },
  });
  
  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
  
  // Run all tests
  const tests: TestResult[] = [];
  
  // Configuration tests (fast)
  tests.push(await testClientExists(clientId));
  tests.push(await testClientActive(clientId));
  tests.push(await testMailerLiteIntegrationExists(clientId));
  tests.push(await testMailerLiteMetaValid(clientId));
  tests.push(await testStripeIntegrationExists(clientId));
  tests.push(await testRecentActivity(clientId));
  
  // API connectivity tests (slower)
  tests.push(await testMailerLiteAPI(clientId));
  tests.push(await testLandingPage(client.slug));
  tests.push(await testStripeWebhook(client.slug));
  
  // Calculate overall status
  const hasFails = tests.some((t) => t.status === 'FAIL');
  const hasWarns = tests.some((t) => t.status === 'WARN');
  const overallStatus: TestStatus = hasFails ? 'FAIL' : hasWarns ? 'WARN' : 'PASS';
  
  const response: HealthCheckResponse = {
    clientId: client.id,
    clientName: client.name,
    clientSlug: client.slug,
    timestamp: new Date().toISOString(),
    overallStatus,
    duration: Date.now() - overallStart,
    tests,
  };
  
  return NextResponse.json(response);
}
