/**
 * Next.js Instrumentation
 * 
 * This file is used to initialize Sentry on the server side.
 * It's automatically loaded by Next.js when the server starts.
 * 
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
