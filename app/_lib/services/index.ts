/**
 * Service Layer Exports
 * Import from '@/app/_lib/services'
 * 
 * @deprecated These services are deprecated in favor of the workflow engine.
 * Use emitTrigger() from '@/app/_lib/workflow' instead.
 * 
 * Migration guide:
 * - CaptureService.captureEmail() → emitTrigger(clientId, { adapter: 'revline', operation: 'email_captured' }, payload)
 * - WebhookService.processStripeCheckout() → emitTrigger(clientId, { adapter: 'stripe', operation: 'payment_succeeded' }, payload)
 */

export { CaptureService } from './capture.service';
export type { CaptureEmailParams } from './capture.service';

export { WebhookService } from './webhook.service';
export type { ProcessCheckoutParams } from './webhook.service';
