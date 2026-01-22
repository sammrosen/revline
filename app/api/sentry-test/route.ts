/**
 * Sentry Test Route
 * 
 * Triggers a test error to verify Sentry is working.
 * DELETE THIS FILE after verifying Sentry works.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // Throw an error that Sentry will capture
  throw new Error('Sentry test error - delete app/api/sentry-test/route.ts after verifying');
}
