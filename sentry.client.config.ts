/**
 * Sentry Client Configuration
 * 
 * Browser-side error tracking and performance monitoring.
 * Automatically captures unhandled exceptions and promise rejections.
 * 
 * STANDARDS:
 * - Scrubs sensitive data (Bearer tokens, API keys) from breadcrumbs
 * - Only enabled in production to avoid noise during development
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment identification
  environment: process.env.NODE_ENV,
  
  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',
  
  // Sample 10% of transactions for performance monitoring
  tracesSampleRate: 0.1,
  
  // Capture 100% of errors
  sampleRate: 1.0,
  
  // Replay configuration (captures user sessions on errors)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  
  // Scrub sensitive data before sending to Sentry
  beforeSend(event) {
    // Remove any potential secrets from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.filter((breadcrumb) => {
        const message = (breadcrumb.message || '').toLowerCase();
        const data = JSON.stringify(breadcrumb.data || {}).toLowerCase();
        
        // Filter out breadcrumbs that might contain secrets
        return (
          !message.includes('bearer') &&
          !message.includes('apikey') &&
          !message.includes('api_key') &&
          !message.includes('secret') &&
          !message.includes('password') &&
          !message.includes('token') &&
          !data.includes('bearer') &&
          !data.includes('apikey') &&
          !data.includes('secret')
        );
      });
    }
    
    return event;
  },
  
  // Don't send PII by default
  sendDefaultPii: false,
  
  // Integrations
  integrations: [
    Sentry.replayIntegration(),
  ],
});
