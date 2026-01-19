import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromHeaders } from '@/app/_lib/auth';
import { prisma } from '@/app/_lib/db';
import { getWorkspaceAccess } from '@/app/_lib/workspace-access';
import { decryptSecret } from '@/app/_lib/crypto';
import { MailerLiteMeta, isMailerLiteMeta, IntegrationSecret } from '@/app/_lib/types';
import { ObservabilityService, SystemMetrics } from '@/app/_lib/observability';

type TestStatus = 'PASS' | 'WARN' | 'FAIL';
type TestCategory = 'configuration' | 'api_connectivity' | 'system_metrics';

interface TestResult {
  category: TestCategory;
  name: string;
  status: TestStatus;
  message: string;
  duration: number;
}

interface HealthCheckResponse {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  timestamp: string;
  overallStatus: TestStatus;
  duration: number;
  tests: TestResult[];
  metrics?: SystemMetrics;
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
async function testClientExists(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const client = await prisma.workspace.findUnique({ where: { id: workspaceId } });
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

async function testClientActive(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const client = await prisma.workspace.findUnique({ where: { id: workspaceId } });
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

async function testMailerLiteIntegrationExists(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const mlIntegration = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: 'MAILERLITE' },
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

async function testMailerLiteMetaValid(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const mlIntegration = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: 'MAILERLITE' },
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

async function testStripeIntegrationExists(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const stripeIntegration = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: 'STRIPE' },
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

async function testRecentActivity(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEvents = await prisma.event.findMany({
      where: {
        workspaceId,
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
async function testMailerLiteAPI(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const mlIntegration = await prisma.workspaceIntegration.findFirst({
      where: { workspaceId, integration: 'MAILERLITE' },
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
    const webhookUrl = `${baseUrl}/api/v1/stripe-webhook?source=${clientSlug}`;
    
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

// System Metrics Tests
async function testEventRate(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const metrics = await ObservabilityService.getMetrics(workspaceId);
    const thresholds = ObservabilityService.getThresholds();
    const duration = Date.now() - start;
    
    if (metrics.events.totalLastHour === 0) {
      return {
        category: 'system_metrics',
        name: 'Event Rate',
        status: 'WARN',
        message: 'No events in the last hour',
        duration,
      };
    }
    
    if (metrics.events.errorRatePercent > thresholds.errorRatePercent) {
      return {
        category: 'system_metrics',
        name: 'Event Rate',
        status: 'FAIL',
        message: `High error rate: ${metrics.events.errorRatePercent.toFixed(1)}% (${metrics.events.failedLastHour}/${metrics.events.totalLastHour} failed)`,
        duration,
      };
    }
    
    return {
      category: 'system_metrics',
      name: 'Event Rate',
      status: 'PASS',
      message: `${metrics.events.totalLastHour} events in last hour, ${metrics.events.errorRatePercent.toFixed(1)}% error rate`,
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'system_metrics',
      name: 'Event Rate',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testWebhookBacklog(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const metrics = await ObservabilityService.getMetrics(workspaceId);
    const thresholds = ObservabilityService.getThresholds();
    const duration = Date.now() - start;
    
    const totalBacklog = metrics.webhooks.pending + metrics.webhooks.processing;
    
    if (totalBacklog > thresholds.webhookBacklogMax) {
      return {
        category: 'system_metrics',
        name: 'Webhook Queue',
        status: 'FAIL',
        message: `${totalBacklog} webhooks in queue (threshold: ${thresholds.webhookBacklogMax})`,
        duration,
      };
    }
    
    if (metrics.webhooks.oldestPendingMinutes !== null && 
        metrics.webhooks.oldestPendingMinutes > thresholds.stuckProcessingMinutes) {
      return {
        category: 'system_metrics',
        name: 'Webhook Queue',
        status: 'FAIL',
        message: `Oldest webhook pending for ${metrics.webhooks.oldestPendingMinutes} minutes`,
        duration,
      };
    }
    
    if (metrics.webhooks.failed > 0) {
      return {
        category: 'system_metrics',
        name: 'Webhook Queue',
        status: 'WARN',
        message: `${metrics.webhooks.failed} failed webhook(s) need attention`,
        duration,
      };
    }
    
    if (totalBacklog === 0) {
      return {
        category: 'system_metrics',
        name: 'Webhook Queue',
        status: 'PASS',
        message: 'No pending webhooks',
        duration,
      };
    }
    
    return {
      category: 'system_metrics',
      name: 'Webhook Queue',
      status: 'PASS',
      message: `${totalBacklog} webhook(s) in queue, processing normally`,
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'system_metrics',
      name: 'Webhook Queue',
      status: 'FAIL',
      message: `Error: ${message}`,
      duration: Date.now() - start,
    };
  }
}

async function testWorkflowHealth(workspaceId: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const metrics = await ObservabilityService.getMetrics(workspaceId);
    const thresholds = ObservabilityService.getThresholds();
    const duration = Date.now() - start;
    
    if (metrics.workflows.failedLastHour > thresholds.failedWorkflowsPerHour) {
      return {
        category: 'system_metrics',
        name: 'Workflow Health',
        status: 'FAIL',
        message: `${metrics.workflows.failedLastHour} workflow failures in last hour (threshold: ${thresholds.failedWorkflowsPerHour})`,
        duration,
      };
    }
    
    if (metrics.workflows.runningNow > 10) {
      return {
        category: 'system_metrics',
        name: 'Workflow Health',
        status: 'WARN',
        message: `${metrics.workflows.runningNow} workflows currently running (high load)`,
        duration,
      };
    }
    
    if (metrics.workflows.failedLastHour > 0) {
      return {
        category: 'system_metrics',
        name: 'Workflow Health',
        status: 'WARN',
        message: `${metrics.workflows.failedLastHour} workflow failure(s) in last hour`,
        duration,
      };
    }
    
    return {
      category: 'system_metrics',
      name: 'Workflow Health',
      status: 'PASS',
      message: `${metrics.workflows.runningNow} running, ${metrics.workflows.failedLastHour} failed in last hour`,
      duration,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      category: 'system_metrics',
      name: 'Workflow Health',
      status: 'FAIL',
      message: `Error: ${message}`,
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
  
  // Check user authentication
  // Middleware handles auth - if we reach here, user is authenticated
  const userId = await getUserIdFromHeaders();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { id: workspaceId } = await params;

  // Verify user has access to this workspace
  const access = await getWorkspaceAccess(userId, workspaceId);
  if (!access) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  
  // Get workspace info
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true },
  });
  
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  
  // Run all tests
  const tests: TestResult[] = [];
  
  // Configuration tests (fast)
  tests.push(await testClientExists(workspaceId));
  tests.push(await testClientActive(workspaceId));
  tests.push(await testMailerLiteIntegrationExists(workspaceId));
  tests.push(await testMailerLiteMetaValid(workspaceId));
  tests.push(await testStripeIntegrationExists(workspaceId));
  tests.push(await testRecentActivity(workspaceId));
  
  // API connectivity tests (slower)
  tests.push(await testMailerLiteAPI(workspaceId));
  tests.push(await testLandingPage(workspace.slug));
  tests.push(await testStripeWebhook(workspace.slug));
  
  // System metrics tests (workspace-scoped)
  tests.push(await testEventRate(workspaceId));
  tests.push(await testWebhookBacklog(workspaceId));
  tests.push(await testWorkflowHealth(workspaceId));
  
  // Get full metrics for response
  let metrics: SystemMetrics | undefined;
  try {
    metrics = await ObservabilityService.getMetrics(workspaceId);
  } catch {
    // Metrics fetch failed, but don't fail the whole health check
  }
  
  // Calculate overall status
  const hasFails = tests.some((t) => t.status === 'FAIL');
  const hasWarns = tests.some((t) => t.status === 'WARN');
  const overallStatus: TestStatus = hasFails ? 'FAIL' : hasWarns ? 'WARN' : 'PASS';
  
  const response: HealthCheckResponse = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    timestamp: new Date().toISOString(),
    overallStatus,
    duration: Date.now() - overallStart,
    tests,
    metrics,
  };
  
  return NextResponse.json(response);
}
