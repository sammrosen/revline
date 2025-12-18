import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { emitEvent, EventSystem } from '@/app/_lib/event-logger';
import { HealthStatus, ClientStatus } from '@prisma/client';
import { Resend } from 'resend';

// Hard-fail without proper authentication
function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Route protection - hard-fail without secret
  if (!validateAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const issues: string[] = [];

  try {
    // Get all active clients with their integrations
    const clients = await prisma.client.findMany({
      where: { status: ClientStatus.ACTIVE },
      include: {
        integrations: true,
      },
    });

    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const client of clients) {
      for (const integration of client.integrations) {
        const previousStatus = integration.healthStatus;
        let newStatus: HealthStatus = HealthStatus.GREEN;

        // Check 1: Integration silence (no events in 4+ hours)
        if (integration.lastSeenAt && integration.lastSeenAt < fourHoursAgo) {
          newStatus = HealthStatus.YELLOW;
          issues.push(
            `${client.name}: ${integration.integration} silent for 4+ hours`
          );
        }

        // Check 2: Consecutive failures
        const recentEvents = await prisma.event.findMany({
          where: {
            clientId: client.id,
            system: integration.integration as unknown as EventSystem,
            createdAt: { gte: fourHoursAgo },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        const consecutiveFailures = recentEvents
          .slice(0, 3)
          .filter((e) => !e.success).length;

        if (consecutiveFailures >= 3) {
          newStatus = HealthStatus.RED;
          issues.push(
            `${client.name}: ${integration.integration} has 3+ consecutive failures`
          );
        }

        // Update health status if changed
        if (newStatus !== previousStatus) {
          await prisma.clientIntegration.update({
            where: { id: integration.id },
            data: { healthStatus: newStatus },
          });

          await emitEvent({
            clientId: client.id,
            system: EventSystem.CRON,
            eventType: 'health_status_changed',
            success: true,
            errorMessage: `${integration.integration}: ${previousStatus} → ${newStatus}`,
          });
        }
      }

      // Check 3: Stuck leads (captured but no progress in 24h)
      const stuckLeads = await prisma.lead.count({
        where: {
          clientId: client.id,
          stage: 'CAPTURED',
          lastEventAt: { lt: twentyFourHoursAgo },
        },
      });

      if (stuckLeads > 0) {
        issues.push(`${client.name}: ${stuckLeads} leads stuck for 24+ hours`);
      }
    }

    // Send alert email if there are issues
    if (issues.length > 0) {
      await sendAlertEmail(issues);
    }

    return NextResponse.json({
      success: true,
      clientsChecked: clients.length,
      issuesFound: issues.length,
      issues: issues.length > 0 ? issues : undefined,
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}

async function sendAlertEmail(issues: string[]): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ADMIN_ALERT_EMAIL;

  if (!resendApiKey || !alertEmail) {
    console.warn('Alert email not configured - skipping notification');
    return;
  }

  try {
    const resend = new Resend(resendApiKey);

    await resend.emails.send({
      from: 'SRB RevOps <alerts@resend.dev>',
      to: alertEmail,
      subject: `⚠️ RevOps Alert: ${issues.length} issue(s) detected`,
      text: `Health check detected the following issues:\n\n${issues.map((i) => `• ${i}`).join('\n')}\n\nCheck the admin dashboard for details: /admin/clients`,
    });
  } catch (error) {
    console.error('Failed to send alert email:', error);
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}

