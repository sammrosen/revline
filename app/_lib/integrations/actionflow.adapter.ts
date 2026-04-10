/**
 * ActionFlow Integration Adapter
 *
 * Handles ActionFlow API operations for a specific workspace.
 * ActionFlow is a countertop/stone fabrication ERP — this adapter
 * pushes customers/jobs outbound and reads job/quote data back.
 *
 * Auth: OAuth2 client_credentials → Bearer token + EnterpriseID header.
 * Token is cached in-memory with a 30-minute TTL, refreshed on 401.
 *
 * Secret names:
 * - "Client ID"     — OAuth2 client_id
 * - "Client Secret"  — OAuth2 client_secret
 * - "Username"       — Custom header for token exchange
 * - "Password"       — Custom header for token exchange
 *
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes credentials outside this module
 * - EnterpriseID comes from meta, not secrets
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { ActionFlowMeta, IntegrationResult } from '@/app/_lib/types';

const ACTIONFLOW_BASE_URL = 'https://lite.actionflow.net/api';
const ACTIONFLOW_TIMEOUT_MS = 30_000;
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// Types
// ============================================================================

export interface ActionFlowCustomerResult {
  customerId: number;
  name: string;
  jobs?: ActionFlowJobSummary[];
}

interface ActionFlowJobSummary {
  jobId: number;
  name: string;
  status?: string;
}

export interface ActionFlowJob {
  JobID: number;
  CustomerID: number;
  CustomerName: string;
  EnterpriseID: number;
  JobNum: number;
  Name: string;
  Notes: string | null;
  Status: string | null;
  CreatedDate: string | null;
  Calcs: ActionFlowCalc[];
  [key: string]: unknown;
}

export interface ActionFlowCalc {
  CalcID: number;
  CalcNum: number;
  IsActive: boolean;
  Material: string | null;
  Color: string | null;
  CalcLineItems: ActionFlowCalcLineItem[];
  [key: string]: unknown;
}

export interface ActionFlowCalcLineItem {
  CalcLineItemID: number;
  CalcID: number;
  SKUDescription: string;
  SKUClassDescription: string;
  IsSink: boolean;
  [key: string]: unknown;
}

export interface CreateCustomerOptions {
  name: string;
  phone?: string;
  email?: string;
  address?: {
    street1: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  jobs?: Array<{
    name: string;
    notes?: string;
    status?: string;
  }>;
  actionComment?: string;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Module-level token cache keyed by workspaceId
const tokenCache = new Map<string, TokenCache>();

// ============================================================================
// Adapter
// ============================================================================

export class ActionFlowAdapter extends BaseIntegrationAdapter<ActionFlowMeta> {
  readonly type = IntegrationType.ACTIONFLOW;

  static async forWorkspace(workspaceId: string): Promise<ActionFlowAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<ActionFlowMeta>(
      workspaceId,
      IntegrationType.ACTIONFLOW
    );

    if (!data) return null;

    if (data.secrets.length === 0) {
      console.warn('ActionFlow integration has no secrets configured:', { workspaceId });
      return null;
    }

    return new ActionFlowAdapter(workspaceId, data.secrets, data.meta);
  }

  static async forClient(clientId: string): Promise<ActionFlowAdapter | null> {
    return ActionFlowAdapter.forWorkspace(clientId);
  }

  // ==========================================================================
  // Meta Helpers
  // ==========================================================================

  getEnterpriseId(): string {
    return this.meta?.enterpriseId ?? '';
  }

  getFieldMap(): Record<string, string> {
    return this.meta?.fieldMap ?? {};
  }

  // ==========================================================================
  // Token Management
  // ==========================================================================

  private async getToken(): Promise<string> {
    const cached = tokenCache.get(this.workspaceId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const clientId = this.getSecret('Client ID');
    const clientSecret = this.getSecret('Client Secret');
    const username = this.getSecret('Username');
    const password = this.getSecret('Password');

    if (!clientId || !clientSecret || !username || !password) {
      throw new Error('Missing required ActionFlow credentials');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ACTIONFLOW_TIMEOUT_MS);

    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      });

      const res = await fetch(`${ACTIONFLOW_BASE_URL}/clienttoken`, {
        method: 'POST',
        headers: {
          'UserName': username,
          'Password': password,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      if (!res.ok) {
        tokenCache.delete(this.workspaceId);
        throw new Error(`Token exchange failed: ${res.status}`);
      }

      const json = await res.json() as { access_token?: string; token_type?: string };
      const token = json.access_token;
      if (!token) {
        throw new Error('Token exchange returned no access_token');
      }

      tokenCache.set(this.workspaceId, {
        token,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      });

      return token;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Clear the cached token (e.g., on 401) */
  private invalidateToken(): void {
    tokenCache.delete(this.workspaceId);
  }

  // ==========================================================================
  // API Client
  // ==========================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>,
    isRetry = false,
  ): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; retryable: boolean; retryAfterMs?: number }> {
    let token: string;
    try {
      token = await this.getToken();
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to obtain token',
        status: 0,
        retryable: false,
      };
    }

    const url = new URL(`${ACTIONFLOW_BASE_URL}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    const enterpriseId = this.getEnterpriseId();
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'EnterpriseID': enterpriseId,
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ACTIONFLOW_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
        return { ok: false, error: 'Rate limited by ActionFlow', status: 429, retryable: true, retryAfterMs };
      }

      if (res.status === 401) {
        // Token expired or invalid — refresh and retry once
        if (!isRetry) {
          this.invalidateToken();
          return this.request<T>(method, path, body, queryParams, true);
        }
        return { ok: false, error: 'Invalid credentials', status: 401, retryable: false };
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        return {
          ok: false,
          error: errorText || `ActionFlow API error: ${res.status}`,
          status: res.status,
          retryable: res.status >= 500,
        };
      }

      const text = await res.text();
      if (!text) {
        // ActionFlow returns empty bodies on some mutation endpoints (e.g., inventory create).
        // Callers of those endpoints do not read the data field.
        return { ok: true, data: null as unknown as T };
      }

      const data = JSON.parse(text) as T;
      return { ok: true, data };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'ActionFlow API request timed out', status: 0, retryable: true };
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
  // Customer Operations
  // ==========================================================================

  /**
   * Create a customer in ActionFlow with a lead notification action.
   * This notifies ActionFlow users that a new customer was created.
   */
  async createCustomerWithLead(
    opts: CreateCustomerOptions
  ): Promise<IntegrationResult<ActionFlowCustomerResult>> {
    try {
      const enterpriseId = this.getEnterpriseId();
      const body: Record<string, unknown> = {
        Name: opts.name,
      };

      if (opts.phone) {
        body.Phones = [{
          PhoneNumber: opts.phone,
          PhoneParentType: 'Customer',
          ...(enterpriseId ? { EnterpriseID: enterpriseId } : {}),
        }];
      }

      if (opts.email) {
        body.Emails = [{
          EmailAddress: opts.email,
          EmailParentType: 'Customer',
          ...(enterpriseId ? { EnterpriseID: enterpriseId } : {}),
        }];
      }

      if (opts.address) {
        body.Addresses = [{
          Street1: opts.address.street1,
          City: opts.address.city || '',
          State: opts.address.state || '',
          Zip: opts.address.zip || '',
          AddressParentType: 'Customer',
          ...(enterpriseId ? { EnterpriseID: enterpriseId } : {}),
        }];
      }

      if (opts.actionComment) {
        body.ActionEnts = [{
          ActionComment: opts.actionComment,
        }];
      }

      if (opts.jobs && opts.jobs.length > 0) {
        body.Jobs = opts.jobs.map(j => ({
          Name: j.name,
          Notes: j.notes || '',
          Status: j.status || 'Created',
          CreatedDate: '',
        }));
      }

      const res = await this.request<ActionFlowCustomerResponse>(
        'POST',
        '/customers/createCustomerWithLead',
        body
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();

      const data = res.data;
      const customerId = extractCustomerId(data);
      const customerName = extractCustomerName(data) || opts.name;

      return this.success<ActionFlowCustomerResult>({
        customerId,
        name: customerName,
        jobs: extractJobSummaries(data),
      });
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Unknown error creating customer with lead',
        true
      );
    }
  }

  /**
   * Create a customer in ActionFlow without a lead notification.
   */
  async createCustomer(
    opts: CreateCustomerOptions
  ): Promise<IntegrationResult<ActionFlowCustomerResult>> {
    try {
      const enterpriseId = this.getEnterpriseId();
      const body: Record<string, unknown> = {
        Name: opts.name,
      };

      if (opts.phone) {
        body.Phones = [{
          PhoneNumber: opts.phone,
          EnterpriseID: enterpriseId,
          PhoneParentType: 'Customer',
        }];
      }

      if (opts.email) {
        body.Emails = [{
          EmailAddress: opts.email,
          EnterpriseID: enterpriseId,
          EmailParentType: 'Customer',
        }];
      }

      if (opts.address) {
        body.Addresses = [{
          Street1: opts.address.street1,
          City: opts.address.city || '',
          State: opts.address.state || '',
          Zip: opts.address.zip || '',
          EnterpriseID: enterpriseId,
          AddressParentType: 'Customer',
        }];
      }

      if (opts.jobs && opts.jobs.length > 0) {
        body.Jobs = opts.jobs.map(j => ({
          Name: j.name,
          Notes: j.notes || '',
          Status: j.status || 'Created',
          CreatedDate: '',
        }));
      }

      const res = await this.request<ActionFlowCustomerResponse>(
        'POST',
        '/customers/create',
        body
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();

      const data = res.data;
      const customerId = extractCustomerId(data);
      const customerName = extractCustomerName(data) || opts.name;

      return this.success<ActionFlowCustomerResult>({
        customerId,
        name: customerName,
        jobs: extractJobSummaries(data),
      });
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Unknown error creating customer',
        true
      );
    }
  }

  /**
   * Get a list of all customer names for the enterprise.
   */
  async getCustomers(): Promise<IntegrationResult<string[]>> {
    try {
      const res = await this.request<string[]>('GET', '/Customers');

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data || []);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Unknown error fetching customers',
        true
      );
    }
  }

  // ==========================================================================
  // Job Operations
  // ==========================================================================

  /**
   * Get a job by its JobID, including calc/area data.
   */
  async getJob(
    jobId: number,
    includeCompleted = false
  ): Promise<IntegrationResult<ActionFlowJob>> {
    try {
      const res = await this.request<ActionFlowJob>(
        'GET',
        '/Jobs',
        undefined,
        {
          jobID: String(jobId),
          includeCompleted: String(includeCompleted),
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          return this.error(`Job ${jobId} not found`, false);
        }
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Unknown error fetching job',
        true
      );
    }
  }

  /**
   * Get a job with attached file information (flat listing).
   */
  async getJobWithFiles(
    jobId: number
  ): Promise<IntegrationResult<ActionFlowJob>> {
    try {
      const res = await this.request<ActionFlowJob>(
        'GET',
        '/jobs/flatlisting',
        undefined,
        { jobID: String(jobId) }
      );

      if (!res.ok) {
        if (res.status === 404) {
          return this.error(`Job ${jobId} not found`, false);
        }
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Unknown error fetching job with files',
        true
      );
    }
  }

  // ==========================================================================
  // Config Validation
  // ==========================================================================

  /**
   * Validate the integration config by attempting a token exchange
   * and making a lightweight API call.
   */
  async validateConfig(): Promise<IntegrationResult<{ valid: boolean }>> {
    try {
      // Force a fresh token
      this.invalidateToken();
      const res = await this.request<string[]>('GET', '/Customers');

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(`Config validation failed: ${res.error}`, false);
      }

      await this.touch();
      return this.success({ valid: true });
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Config validation failed',
        false
      );
    }
  }
}

// ============================================================================
// Response Parsing Helpers
// ============================================================================

/**
 * ActionFlow customer creation responses include nested arrays for
 * Phones, Emails, Addresses, Jobs — each with their own IDs.
 * The CustomerID is embedded in the child objects.
 */
interface ActionFlowCustomerResponse {
  Phones?: Array<{ PhoneParentID?: number; [key: string]: unknown }>;
  Emails?: Array<{ EmailParentID?: number; [key: string]: unknown }>;
  Addresses?: Array<{ AddressParentID?: number; [key: string]: unknown }>;
  Jobs?: Array<{
    JobID?: number;
    CustomerID?: number;
    CustomerName?: string;
    Name?: string;
    Status?: string;
    [key: string]: unknown;
  }>;
  CustomerID?: number;
  Name?: string;
  [key: string]: unknown;
}

function extractCustomerId(data: ActionFlowCustomerResponse | null): number {
  if (!data) return 0;
  if (data.CustomerID) return data.CustomerID;
  // CustomerID appears as PhoneParentID, EmailParentID, or AddressParentID in child objects
  if (data.Phones?.[0]?.PhoneParentID) return data.Phones[0].PhoneParentID;
  if (data.Emails?.[0]?.EmailParentID) return data.Emails[0].EmailParentID;
  if (data.Addresses?.[0]?.AddressParentID) return data.Addresses[0].AddressParentID;
  if (data.Jobs?.[0]?.CustomerID) return data.Jobs[0].CustomerID;
  return 0;
}

function extractCustomerName(data: ActionFlowCustomerResponse | null): string | undefined {
  if (!data) return undefined;
  if (data.Name) return String(data.Name);
  if (data.Jobs?.[0]?.CustomerName) return data.Jobs[0].CustomerName;
  return undefined;
}

function extractJobSummaries(data: ActionFlowCustomerResponse | null): ActionFlowJobSummary[] {
  if (!data?.Jobs) return [];
  return data.Jobs.map(j => ({
    jobId: j.JobID || 0,
    name: j.Name || '',
    status: j.Status || undefined,
  }));
}
