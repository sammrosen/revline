/**
 * Service Layer Exports
 * Import from '@/app/_lib/services'
 * 
 * Active services:
 * - CustomFieldService: Workspace-scoped custom field definitions and lead custom data
 * - CaptureService: Form capture validation, processing, and embed generation
 * - InterpolationService: Template variable interpolation
 */

// Custom Field Service
export { CustomFieldService } from './custom-field.service';
export {
  defineField,
  getFieldDefinitions,
  getFieldDefinition,
  updateFieldDefinition,
  deleteFieldDefinition,
  setLeadCustomData,
  getLeadCustomData,
  getLeadCustomDataByEmail,
  validateCustomData,
} from './custom-field.service';

// Interpolation Service
export { InterpolationService } from './interpolation.service';
export {
  interpolate,
  parseTemplate,
  getAvailablePaths,
  validateTemplate,
} from './interpolation.service';

// Capture Service (Form Capture System)
export * as CaptureService from './capture.service';
export {
  getFormById,
  validateCaptureRequest,
  processCapturePayload,
  generateEmbedCode,
  listForms,
  getFormStats,
} from './capture.service';
export type { LoadedForm } from './capture.service';

// Deprecated webhook service (kept for backwards compatibility)
export { WebhookService } from './webhook.service';
export type { ProcessCheckoutParams } from './webhook.service';
