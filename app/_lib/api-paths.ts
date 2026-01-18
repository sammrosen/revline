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
 * Auth API paths
 */
export const AuthApi = {
  login: `${API_BASE}/auth/login`,
  logout: `${API_BASE}/auth/logout`,
  setup: `${API_BASE}/auth/setup`,
  loginVerify2fa: `${API_BASE}/auth/login/verify-2fa`,
  
  // 2FA management
  twoFa: {
    setup: `${API_BASE}/auth/2fa/setup`,
    verify: `${API_BASE}/auth/2fa/verify`,
    disable: `${API_BASE}/auth/2fa/disable`,
    status: `${API_BASE}/auth/2fa/status`,
    regenerate: `${API_BASE}/auth/2fa/regenerate`,
  },
} as const;

/**
 * App API paths (protected routes)
 */
export const AppApi = {
  // Workspaces
  workspaces: {
    list: `${API_BASE}/workspaces`,
    create: `${API_BASE}/workspaces`,
    byId: (id: string) => `${API_BASE}/workspaces/${id}`,
    healthCheck: (id: string) => `${API_BASE}/workspaces/${id}/health-check`,
    testAlert: (id: string) => `${API_BASE}/workspaces/${id}/test-alert`,
    testPushover: (id: string) => `${API_BASE}/workspaces/${id}/test-pushover`,
    testAction: (id: string) => `${API_BASE}/workspaces/${id}/test-action`,
    dependencyGraph: (id: string) => `${API_BASE}/workspaces/${id}/dependency-graph`,
    mailerliteInsights: (id: string) => `${API_BASE}/workspaces/${id}/mailerlite-insights`,
  },
  
  // Integrations
  integrations: {
    list: `${API_BASE}/integrations`,
    create: `${API_BASE}/integrations`,
    byId: (id: string) => `${API_BASE}/integrations/${id}`,
    meta: (id: string) => `${API_BASE}/integrations/${id}/meta`,
    secrets: (id: string) => `${API_BASE}/integrations/${id}/secrets`,
    secretById: (integrationId: string, secretId: string) => 
      `${API_BASE}/integrations/${integrationId}/secrets/${secretId}`,
    syncEventTypes: (id: string) => `${API_BASE}/integrations/${id}/sync-event-types`,
  },
  
  // Workflows
  workflows: {
    list: `${API_BASE}/workflows`,
    create: `${API_BASE}/workflows`,
    byId: (id: string) => `${API_BASE}/workflows/${id}`,
    toggle: (id: string) => `${API_BASE}/workflows/${id}/toggle`,
    executions: (id: string) => `${API_BASE}/workflows/${id}/executions`,
  },
  
  // Registry
  workflowRegistry: `${API_BASE}/workflow-registry`,
  
  // Forms
  forms: `${API_BASE}/forms`,
  checkFormId: `${API_BASE}/check-form-id`,
  
  // Executions
  executions: {
    retry: (execId: string) => `${API_BASE}/executions/${execId}/retry`,
  },
} as const;

/**
 * @deprecated Use AuthApi and AppApi instead
 * Kept for backward compatibility during migration
 */
export const AdminApi = {
  ...AuthApi,
  ...AppApi,
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
  employees: `${API_BASE}/booking/employees`,
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
  auth: AuthApi,
  app: AppApi,
  admin: AdminApi, // deprecated alias
  public: PublicApi,
  booking: BookingApi,
  webhooks: WebhookPaths,
  cron: CronPaths,
  version: API_VERSION,
  base: API_BASE,
} as const;
