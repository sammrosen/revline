/**
 * Health Check Endpoint
 * 
 * Returns 200 OK when the service is healthy, 503 when degraded.
 * Used by:
 * - Railway health checks (auto-restart on failure)
 * - UptimeRobot / external monitors
 * - Load balancers
 * 
 * Checks:
 * - Database connectivity
 * - Pushover configuration (optional)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/app/_lib/db';
import { isPushoverConfigured } from '@/app/_lib/pushover';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    alerts: { status: 'ok' | 'unconfigured' };
  };
  version?: string;
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {
    database: { status: 'ok' },
    alerts: { status: isPushoverConfigured() ? 'ok' : 'unconfigured' },
  };

  let overallStatus: HealthStatus['status'] = 'healthy';

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database.latencyMs = Date.now() - dbStart;
  } catch (error) {
    checks.database.status = 'error';
    checks.database.error = error instanceof Error ? error.message : 'Unknown error';
    overallStatus = 'unhealthy';
  }

  // Alerts unconfigured = degraded (not critical)
  if (checks.alerts.status === 'unconfigured' && overallStatus === 'healthy') {
    overallStatus = 'degraded';
  }

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    version: process.env.npm_package_version || '1.0.0',
  };

  // Return appropriate status code
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  });
}

// HEAD request for simple ping checks
export async function HEAD(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
