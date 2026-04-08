/**
 * Integration Quick Reference
 *
 * Assembles reference data per integration type from the workflow registry,
 * executor map, and static route/scenario config. Server-only — used by
 * the workspace page to pass serialized reference data to the dashboard.
 */

import { ADAPTER_REGISTRY } from '@/app/_lib/workflow/registry';
import { hasActionExecutor } from '@/app/_lib/workflow/executors';
import type { IntegrationReference } from '@/app/_lib/types';

// =============================================================================
// STATIC CONFIG
// =============================================================================

/** Triggers defined in the registry but without a live webhook/ingest route yet */
const PLANNED_TRIGGERS = new Set<string>([]);

/** Actions with executor stubs (log + skip, not fully implemented) */
const STUB_ACTIONS = new Set([
  'mailerlite.remove_from_group',
  'mailerlite.add_tag',
]);

/** Per-integration unique API routes (common CRUD shared by all integrations is excluded) */
const INTEGRATION_ROUTES: Record<string, IntegrationReference['routes']> = {
  STRIPE: [
    { method: 'POST', path: '/api/v1/stripe-webhook', description: 'Inbound Stripe webhook' },
  ],
  CALENDLY: [
    { method: 'POST', path: '/api/v1/calendly-webhook', description: 'Inbound Calendly webhook' },
  ],
  RESEND: [
    { method: 'POST', path: '/api/v1/resend-webhook', description: 'Delivery event webhook' },
    { method: 'POST', path: '/api/v1/resend-inbound', description: 'Inbound email webhook' },
    { method: 'GET', path: '/api/v1/integrations/[id]/resend-templates', description: 'List email templates' },
  ],
  TWILIO: [
    { method: 'POST', path: '/api/v1/twilio-webhook', description: 'Inbound SMS webhook' },
  ],
  MAILERLITE: [
    { method: 'GET', path: '/api/v1/workspaces/[id]/mailerlite-insights', description: 'Subscriber insights' },
  ],
  ABC_IGNITE: [
    { method: 'GET', path: '/api/v1/integrations/[id]/sync-employees', description: 'Fetch staff list' },
    { method: 'GET', path: '/api/v1/integrations/[id]/sync-event-types', description: 'Fetch event types' },
  ],
  PIPEDRIVE: [
    { method: 'GET', path: '/api/v1/integrations/[id]/pipedrive-fields', description: 'List person fields' },
    { method: 'POST', path: '/api/v1/integrations/[id]/test', description: 'Test connection' },
    { method: 'POST', path: '/api/v1/pipedrive-webhook', description: 'Inbound person webhook' },
  ],
  OPENAI: [
    { method: 'GET', path: '/api/v1/integrations/[id]/openai-models', description: 'List available models' },
  ],
  ANTHROPIC: [
    { method: 'GET', path: '/api/v1/integrations/[id]/anthropic-models', description: 'List available models' },
  ],
};

/** E2E test scenarios registered in the test-scenario route, keyed by IntegrationType */
const INTEGRATION_SCENARIOS: Record<string, string[]> = {
  ABC_IGNITE: ['Member Lookup → Add to CRM', 'Member Sync Preview'],
  RESEND: ['Resend Webhook Status'],
};

/** Workflow design tips shown in the reference dialog */
const INTEGRATION_BEST_PRACTICES: Record<string, string[]> = {
  PIPEDRIVE: [
    'Workflow order: Pipedrive create_or_update_person first, then RevLine create_lead — this stores the Pipedrive person ID on the lead for activity logging and sync.',
    'Enable "Log agent activity" in the Pipedrive config to see agent messages on the person\'s timeline.',
    'Generate a webhook secret and register the webhook URL in Pipedrive Settings > Webhooks for inbound sync.',
    'Use "Sync Fields" in the config editor to auto-detect and map Pipedrive fields before building workflows.',
  ],
};

/** Raw API endpoint counts from adapter.knownEndpoints (only wired for ABC Ignite) */
const KNOWN_ENDPOINT_COUNTS: Record<string, number> = {
  ABC_IGNITE: 8,
};

// =============================================================================
// PUBLIC API
// =============================================================================

function toAdapterId(integrationType: string): string {
  return integrationType.toLowerCase();
}

/**
 * Build reference data for a single integration type.
 * Returns null if no matching adapter exists in the registry.
 */
export function getIntegrationReference(integrationType: string): IntegrationReference | null {
  const adapterId = toAdapterId(integrationType);
  const adapter = ADAPTER_REGISTRY[adapterId];
  if (!adapter) return null;

  const triggers: IntegrationReference['triggers'] = Object.values(adapter.triggers).map(t => ({
    operation: t.name,
    label: t.label,
    description: t.description,
    hasTestFields: Array.isArray(t.testFields) && t.testFields.length > 0,
    ...(PLANNED_TRIGGERS.has(`${adapterId}.${t.name}`) && { planned: true }),
  }));

  const actions: IntegrationReference['actions'] = Object.values(adapter.actions).map(a => {
    const key = `${adapterId}.${a.name}`;
    return {
      operation: a.name,
      label: a.label,
      description: a.description,
      hasTestFields: Array.isArray(a.testFields) && a.testFields.length > 0,
      implemented: hasActionExecutor(adapterId, a.name),
      ...(STUB_ACTIONS.has(key) && { stub: true }),
    };
  });

  const routes = INTEGRATION_ROUTES[integrationType] ?? [];
  const scenarios = INTEGRATION_SCENARIOS[integrationType] ?? [];
  const bestPractices = INTEGRATION_BEST_PRACTICES[integrationType] ?? [];

  return {
    integration: integrationType,
    adapterId,
    triggers,
    actions,
    routes,
    testSuite: {
      triggerTests: triggers.filter(t => t.hasTestFields).length,
      actionTests: actions.filter(a => a.hasTestFields).length,
      knownEndpoints: KNOWN_ENDPOINT_COUNTS[integrationType] ?? 0,
      scenarios,
    },
    requires: {
      secrets: adapter.requirements?.secrets ?? [],
      metaKeys: adapter.requirements?.metaKeys ?? [],
    },
    bestPractices,
  };
}

/**
 * Build reference data for multiple integration types.
 * Returns a record keyed by IntegrationType string.
 */
export function getIntegrationReferences(
  integrationTypes: string[]
): Record<string, IntegrationReference> {
  const refs: Record<string, IntegrationReference> = {};
  for (const type of integrationTypes) {
    const ref = getIntegrationReference(type);
    if (ref) {
      refs[type] = ref;
    }
  }
  return refs;
}
