/**
 * Sentry Edge Configuration
 * 
 * Error tracking for Edge runtime (middleware).
 * 
 * STANDARDS:
 * - Only enabled in production
 * - Minimal configuration for edge runtime constraints
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  
  // Environment identification
  environment: process.env.NODE_ENV,
  
  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Sample 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,
  
  // Capture 100% of errors
  sampleRate: 1.0,
});
