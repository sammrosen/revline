/**
 * Integration Exports (Backward Compatibility)
 * 
 * This file re-exports from the new locations for backward compatibility.
 * 
 * PREFERRED: Import directly from '@/app/_lib/integrations' for adapters
 * or '@/app/_lib/integrations-core' for low-level functions.
 * 
 * @deprecated Use '@/app/_lib/integrations' for adapters
 */

// Re-export everything from integrations directory
export * from './integrations/index';

// Re-export core functions for backward compat
export {
  getClientSecret,
  getClientIntegration,
  touchIntegration,
  markIntegrationUnhealthy,
} from './integrations-core';




