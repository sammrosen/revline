/**
 * API Path Definitions
 * 
 * Centralized API path definitions for all endpoints.
 * Use these constants throughout the frontend to ensure consistency
 * and enable easy version changes in the future.
 * 
 * STANDARDS:
 * - All API calls should use these paths
 * - Version changes only need to update API_VERSION
 * - Paths are typed for IDE autocompletion
 */

export const API_VERSION = 'v1';
export const API_BASE = `/api/${API_VERSION}`;

/**
 * Admin API paths
 */
export const AdminApi = {
  // Auth
  login: `${API_BASE}/admin/login`,
  logout: `${API_BASE}/admin/logout`,
  setup: `${API_BASE}/admin/setup`,
  
  // 2FA
  twoFa: {
    setup: `${API_BASE}/admin/2fa/setup`,
    verify: `${API_BASE}/admin/2fa/verify`,
    disable: `${API_BASE}/admin/2fa/disable`,
    status: `${API_BASE}/admin/2fa/status`,
    regenerate: `${API_BASE}/admin/2fa/regenerate`,
  },
  
  // Login 2FA verification
  loginVerify2fa: `${API_BASE}/admin/login/verify-2fa`,
  
  // Workspaces
  workspaces: {
    list: `${API_BASE}/admin/workspaces`,
    create: `${API_BASE}/admin/workspaces`,
    byId: (id: string) => `${API_BASE}/admin/workspaces/${id}`,
    healthCheck: (id: string) => `${API_BASE}/admin/workspaces/${id}/health-check`,
    testAlert: (id: string) => `${API_BASE}/admin/workspaces/${id}/test-alert`,
    testPushover: (id: string) => `${API_BASE}/admin/workspaces/${id}/test-pushover`,
    testAction: (id: string) => `${API_BASE}/admin/workspaces/${id}/test-action`,
    dependencyGraph: (id: string) => `${API_BASE}/admin/workspaces/${id}/dependency-graph`,
    mailerliteInsights: (id: string) => `${API_BASE}/admin/workspaces/${id}/mailerlite-insights`,
  },
  
  // Integrations
  integrations: {
    list: `${API_BASE}/admin/integrations`,
    create: `${API_BASE}/admin/integrations`,
    byId: (id: string) => `${API_BASE}/admin/integrations/${id}`,
    meta: (id: string) => `${API_BASE}/admin/integrations/${id}/meta`,
    secrets: (id: string) => `${API_BASE}/admin/integrations/${id}/secrets`,
    secretById: (integrationId: string, secretId: string) => 
      `${API_BASE}/admin/integrations/${integrationId}/secrets/${secretId}`,
    syncEventTypes: (id: string) => `${API_BASE}/admin/integrations/${id}/sync-event-types`,
  },
  
  // Workflows
  workflows: {
    list: `${API_BASE}/admin/workflows`,
    create: `${API_BASE}/admin/workflows`,
    byId: (id: string) => `${API_BASE}/admin/workflows/${id}`,
    toggle: (id: string) => `${API_BASE}/admin/workflows/${id}/toggle`,
    executions: (id: string) => `${API_BASE}/admin/workflows/${id}/executions`,
  },
  
  // Registry
  workflowRegistry: `${API_BASE}/admin/workflow-registry`,
  
  // Forms
  forms: `${API_BASE}/admin/forms`,
  checkFormId: `${API_BASE}/admin/check-form-id`,
  
  // Executions
  executions: {
    retry: (execId: string) => `${API_BASE}/admin/executions/${execId}/retry`,
  },
} as const;

/**
 * Public API paths
 */
export const PublicApi = {
  subscribe: `${API_BASE}/subscribe`,
  formSubmit: `${API_BASE}/form-submit`,
  health: `${API_BASE}/health`,
} as const;

/**
 * Booking API paths
 */
export const BookingApi = {
  lookup: `${API_BASE}/booking/lookup`,
  availability: `${API_BASE}/booking/availability`,
  eligibility: `${API_BASE}/booking/eligibility`,
  create: `${API_BASE}/booking/create`,
} as const;

/**
 * Webhook paths (for external services to call)
 */
export const WebhookPaths = {
  stripe: (source: string) => `${API_BASE}/stripe-webhook?source=${source}`,
  calendly: `${API_BASE}/calendly-webhook`,
} as const;

/**
 * Cron paths (for scheduled tasks)
 */
export const CronPaths = {
  healthCheck: `${API_BASE}/cron/health-check`,
} as const;

/**
 * All API paths combined for convenience
 */
export const ApiPaths = {
  admin: AdminApi,
  public: PublicApi,
  booking: BookingApi,
  webhooks: WebhookPaths,
  cron: CronPaths,
  version: API_VERSION,
  base: API_BASE,
} as const;
