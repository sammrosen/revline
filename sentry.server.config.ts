/**
 * Sentry Server Configuration
 * 
 * Server-side error tracking for API routes and SSR.
 * Automatically captures unhandled exceptions and promise rejections.
 * 
 * STANDARDS:
 * - Scrubs sensitive headers (authorization, cookies, API keys)
 * - Scrubs sensitive data from breadcrumbs
 * - Only enabled in production
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
  
  // Scrub sensitive data before sending to Sentry
  beforeSend(event) {
    // Scrub sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
      delete event.request.headers['x-auth-token'];
    }
    
    // Remove authorization from request data
    if (event.request?.data) {
      const data = event.request.data;
      if (typeof data === 'string') {
        // Try to parse and scrub JSON data
        try {
          const parsed = JSON.parse(data);
          delete parsed.password;
          delete parsed.token;
          delete parsed.apiKey;
          delete parsed.secret;
          event.request.data = JSON.stringify(parsed);
        } catch {
          // Not JSON, leave as is
        }
      }
    }
    
    // Scrub sensitive data from breadcrumbs
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
          !message.includes('cron_secret') &&
          !message.includes('encryption_key') &&
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
});
