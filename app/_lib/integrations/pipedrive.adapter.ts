/**
 * Pipedrive Integration Adapter
 * 
 * Handles Pipedrive API operations for a specific workspace.
 * Persons are searched by email (search-then-upsert) since Pipedrive
 * has no native upsert-by-email endpoint.
 * 
 * Secret names:
 * - "API Token" - Required for all operations
 * 
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes API token outside this module
 * - Person IDs from Pipedrive are the primary reference — not emails
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { PipedriveMeta, IntegrationResult } from '@/app/_lib/types';

export const PIPEDRIVE_API_TOKEN_SECRET = 'API Token';

const PIPEDRIVE_BASE_URL = 'https://api.pipedrive.com';
const PIPEDRIVE_TIMEOUT_MS = 30_000;

// ============================================================================
// Types
// ============================================================================

export interface PipedrivePersonResult {
  pipedrivePersonId: number;
  isNew: boolean;
  name?: string;
  email?: string;
  phone?: string;
}

export interface PipedrivePerson {
  id: number;
  name: string | null;
  email: Array<{ value: string; primary: boolean }>;
  phone: Array<{ value: string; primary: boolean }>;
  org_id: number | null;
  [key: string]: unknown;
}

interface PipedriveApiResponse<T> {
  success: boolean;
  data: T;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
    };
  };
}

interface PipedriveSearchResult {
  items: Array<{
    item: PipedrivePerson;
    result_score: number;
  }>;
}

interface PipedriveApiError {
  success: false;
  error: string;
  error_info?: string;
}

export interface PipedriveField {
  key: string;
  name: string;
  fieldType: string;
  isCustom: boolean;
}

interface PipedriveRawField {
  key: string;
  name: string;
  field_type: string;
  edit_flag: boolean;
  add_visible_flag?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// Adapter
// ============================================================================

export class PipedriveAdapter extends BaseIntegrationAdapter<PipedriveMeta> {
  readonly type = IntegrationType.PIPEDRIVE;

  static async forWorkspace(workspaceId: string): Promise<PipedriveAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<PipedriveMeta>(
      workspaceId,
      IntegrationType.PIPEDRIVE
    );

    if (!data) return null;

    if (data.secrets.length === 0) {
      console.warn('Pipedrive integration has no secrets configured:', { workspaceId });
      return null;
    }

    return new PipedriveAdapter(workspaceId, data.secrets, data.meta);
  }

  static async forClient(clientId: string): Promise<PipedriveAdapter | null> {
    return PipedriveAdapter.forWorkspace(clientId);
  }

  // ==========================================================================
  // API Client
  // ==========================================================================

  private getToken(): string {
    return this.getSecret(PIPEDRIVE_API_TOKEN_SECRET) || this.getPrimarySecret();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; retryable: boolean; retryAfterMs?: number }> {
    const url = new URL(`${PIPEDRIVE_BASE_URL}${path}`);
    url.searchParams.set('api_token', this.getToken());
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PIPEDRIVE_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
        return { ok: false, error: 'Rate limited by Pipedrive', status: 429, retryable: true, retryAfterMs };
      }

      if (res.status === 401) {
        return { ok: false, error: 'Invalid API token', status: 401, retryable: false };
      }

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({})) as PipedriveApiError;
        return {
          ok: false,
          error: errorBody.error || `Pipedrive API error: ${res.status}`,
          status: res.status,
          retryable: res.status >= 500,
        };
      }

      const json = await res.json() as PipedriveApiResponse<T>;
      if (!json.success) {
        return { ok: false, error: 'Pipedrive returned success: false', status: res.status, retryable: false };
      }

      return { ok: true, data: json.data };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'Pipedrive API request timed out', status: 0, retryable: true };
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown fetch error',
        status: 0,
        retryable: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==========================================================================
  // Person Operations
  // ==========================================================================

  /**
   * Search for a person by email.
   * Returns the first exact match or null.
   */
  private async searchPersonByEmail(email: string): Promise<PipedrivePerson | null> {
    const res = await this.request<PipedriveSearchResult>(
      'GET',
      '/v1/persons/search',
      undefined,
      { term: email, fields: 'email', exact_match: 'true', limit: '1' }
    );

    if (!res.ok) return null;

    const items = res.data?.items;
    if (!items || items.length === 0) return null;

    return items[0].item;
  }

  /**
   * Create or update a person in Pipedrive.
   * Searches by email first (Pipedrive has no native upsert-by-email).
   * Returns the person ID — the critical value for linking.
   */
  async createOrUpdatePerson(
    email: string,
    name?: string,
    fields?: Record<string, string>
  ): Promise<IntegrationResult<PipedrivePersonResult>> {
    try {
      const existing = await this.searchPersonByEmail(email);

      if (existing) {
        const updateBody: Record<string, unknown> = {};
        if (name) updateBody.name = name;
        if (fields) Object.assign(updateBody, fields);

        if (Object.keys(updateBody).length > 0) {
          const updateRes = await this.request<PipedrivePerson>(
            'PUT',
            `/v1/persons/${existing.id}`,
            updateBody
          );

          if (!updateRes.ok) {
            await this.markUnhealthy();
            return this.error(updateRes.error, updateRes.retryable, updateRes.retryAfterMs);
          }
        }

        await this.touch();
        return this.success({
          pipedrivePersonId: existing.id,
          isNew: false,
          name: existing.name ?? undefined,
          email,
        });
      }

      // Create new person
      const createBody: Record<string, unknown> = {
        email: [{ value: email, primary: true, label: 'work' }],
      };
      if (name) createBody.name = name;
      if (fields) Object.assign(createBody, fields);
      if (!createBody.name) createBody.name = email.split('@')[0];

      const createRes = await this.request<PipedrivePerson>('POST', '/v1/persons', createBody);

      if (!createRes.ok) {
        await this.markUnhealthy();
        return this.error(createRes.error, createRes.retryable, createRes.retryAfterMs);
      }

      await this.touch();
      return this.success({
        pipedrivePersonId: createRes.data.id,
        isNew: true,
        name: createRes.data.name ?? undefined,
        email,
      });
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to create/update Pipedrive person',
        true
      );
    }
  }

  /**
   * Get a person by Pipedrive ID.
   */
  async getPerson(pipedrivePersonId: number): Promise<IntegrationResult<PipedrivePerson | null>> {
    const res = await this.request<PipedrivePerson>('GET', `/v1/persons/${pipedrivePersonId}`);

    if (!res.ok) {
      if (res.status === 404) return this.success(null);
      return this.error(res.error, res.retryable, res.retryAfterMs);
    }

    return this.success(res.data);
  }

  /**
   * Update specific fields on an existing person by Pipedrive ID.
   */
  async updatePersonFields(
    pipedrivePersonId: number,
    fields: Record<string, string>
  ): Promise<IntegrationResult<void>> {
    if (Object.keys(fields).length === 0) {
      return this.success(undefined);
    }

    const res = await this.request<PipedrivePerson>(
      'PUT',
      `/v1/persons/${pipedrivePersonId}`,
      fields
    );

    if (!res.ok) {
      await this.markUnhealthy();
      return this.error(res.error, res.retryable, res.retryAfterMs);
    }

    await this.touch();
    return this.success(undefined);
  }

  /**
   * Validate the integration config (test the API token).
   */
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      this.getToken();
    } catch {
      errors.push('No API Token configured');
      return { valid: false, errors };
    }

    const res = await this.request<unknown>('GET', '/v1/users/me');
    if (!res.ok) {
      errors.push(`API token validation failed: ${res.error}`);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  // ==========================================================================
  // Field Schema
  // ==========================================================================

  /**
   * Fetch all person fields from the Pipedrive account.
   * Built-in fields (name, email, phone) have edit_flag=false.
   * Custom fields have edit_flag=true and hash-like keys.
   */
  async listPersonFields(): Promise<IntegrationResult<PipedriveField[]>> {
    const res = await this.request<PipedriveRawField[]>('GET', '/v1/personFields');

    if (!res.ok) {
      await this.markUnhealthy();
      return this.error(res.error, res.retryable, res.retryAfterMs);
    }

    const fields: PipedriveField[] = (res.data || []).map(f => ({
      key: f.key,
      name: f.name,
      fieldType: f.field_type,
      isCustom: f.edit_flag === true,
    }));

    await this.touch();
    return this.success(fields);
  }

  // ==========================================================================
  // Activity Logging
  // ==========================================================================

  /**
   * Create an activity on a person's timeline in Pipedrive.
   * Used for logging agent messages (SMS, email) as post-send hooks.
   */
  async createActivity(opts: {
    personId: number;
    type: string;
    subject: string;
    note: string;
    done: boolean;
  }): Promise<IntegrationResult<{ activityId: number }>> {
    try {
      const res = await this.request<{ id: number }>(
        'POST',
        '/v1/activities',
        {
          person_id: opts.personId,
          type: opts.type,
          subject: opts.subject,
          note: opts.note,
          done: opts.done ? 1 : 0,
        },
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success({ activityId: res.data.id });
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to create Pipedrive activity',
        true,
      );
    }
  }

  // ==========================================================================
  // Meta Helpers
  // ==========================================================================

  getFieldMap(): Record<string, string> {
    return this.meta?.fieldMap ?? {};
  }

  getStageMap(): Record<string, number> {
    return this.meta?.stageMap ?? {};
  }

  getDefaultPipelineId(): number | undefined {
    return this.meta?.defaultPipelineId ?? undefined;
  }

  getWebhookSecret(): string | undefined {
    return this.meta?.webhookSecret ?? undefined;
  }

  isActivityLoggingEnabled(): boolean {
    return this.meta?.logActivities === true;
  }
}
