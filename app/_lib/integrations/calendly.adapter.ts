/**
 * Calendly Integration Adapter
 *
 * Handles Calendly API operations for a specific workspace.
 * Uses Personal Access Token (PAT) for authentication.
 *
 * Secret names:
 * - "API Key" - Personal Access Token for Calendly API calls
 * - "Webhook Secret" - Signing key for webhook signature verification
 *
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes API token outside this module
 * - See docs/STANDARDS.md for full requirements
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { CalendlyMeta, IntegrationResult } from '@/app/_lib/types';

export const CALENDLY_API_KEY_SECRET = 'API Key';

const CALENDLY_BASE_URL = 'https://api.calendly.com';
const CALENDLY_TIMEOUT_MS = 30_000;

// ============================================================================
// Types
// ============================================================================

export interface CalendlyUser {
  uri: string;
  name: string;
  slug: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  current_organization: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  slug: string;
  scheduling_url: string;
  duration: number;
  kind: string;
  type: string;
  color: string;
  description_plain: string | null;
}

export interface CalendlyAvailableTime {
  status: string;
  invitees_remaining: number;
  start_time: string;
  scheduling_url: string;
}

export interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  event_type: string;
  location: {
    type: string;
    location?: string;
  } | null;
  invitees_counter: {
    total: number;
    active: number;
    limit: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CalendlyApiError {
  title: string;
  message: string;
  details?: Array<{ parameter: string; message: string }>;
}

interface CalendlyCollectionResponse<T> {
  collection: T[];
  pagination: {
    count: number;
    next_page: string | null;
    previous_page: string | null;
    next_page_token: string | null;
  };
}

// ============================================================================
// Adapter
// ============================================================================

export class CalendlyAdapter extends BaseIntegrationAdapter<CalendlyMeta> {
  readonly type = IntegrationType.CALENDLY;

  static async forWorkspace(workspaceId: string): Promise<CalendlyAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<CalendlyMeta>(
      workspaceId,
      IntegrationType.CALENDLY
    );

    if (!data) return null;

    // Check that API Key secret exists
    const hasApiKey = data.secrets.some(s => s.name === CALENDLY_API_KEY_SECRET);
    if (!hasApiKey) {
      console.warn('Calendly integration has no API Key configured:', { workspaceId });
      return null;
    }

    return new CalendlyAdapter(workspaceId, data.secrets, data.meta);
  }

  static async forClient(clientId: string): Promise<CalendlyAdapter | null> {
    return CalendlyAdapter.forWorkspace(clientId);
  }

  // ==========================================================================
  // API Client
  // ==========================================================================

  private getToken(): string {
    return this.getSecret(CALENDLY_API_KEY_SECRET) || this.getPrimarySecret();
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; retryable: boolean; retryAfterMs?: number }> {
    const url = new URL(`${CALENDLY_BASE_URL}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CALENDLY_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
        return { ok: false, error: 'Rate limited by Calendly', status: 429, retryable: true, retryAfterMs };
      }

      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: 'Invalid or expired API token', status: res.status, retryable: false };
      }

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({})) as CalendlyApiError;
        return {
          ok: false,
          error: errorBody.message || `Calendly API error: ${res.status}`,
          status: res.status,
          retryable: res.status >= 500,
        };
      }

      const json = await res.json() as T;
      return { ok: true, data: json };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'Calendly API request timed out', status: 0, retryable: true };
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
  // User Operations
  // ==========================================================================

  /**
   * Get the authenticated user's profile.
   * Returns the user URI needed for listing event types.
   */
  async getCurrentUser(): Promise<IntegrationResult<CalendlyUser>> {
    try {
      const res = await this.request<{ resource: CalendlyUser }>('GET', '/users/me');

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data.resource);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to get Calendly user',
        true
      );
    }
  }

  // ==========================================================================
  // Event Type Operations
  // ==========================================================================

  /**
   * List event types for a user.
   * @param userUri - The user's URI (from getCurrentUser)
   */
  async listEventTypes(userUri: string): Promise<IntegrationResult<CalendlyEventType[]>> {
    try {
      const res = await this.request<CalendlyCollectionResponse<CalendlyEventType>>(
        'GET',
        '/event_types',
        undefined,
        { user: userUri, active: 'true' }
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data.collection);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to list Calendly event types',
        true
      );
    }
  }

  // ==========================================================================
  // Availability Operations
  // ==========================================================================

  /**
   * Get available times for an event type.
   * @param eventTypeUri - The event type's URI
   * @param startTime - ISO 8601 start time
   * @param endTime - ISO 8601 end time
   */
  async getAvailableTimes(
    eventTypeUri: string,
    startTime: string,
    endTime: string
  ): Promise<IntegrationResult<CalendlyAvailableTime[]>> {
    try {
      const res = await this.request<CalendlyCollectionResponse<CalendlyAvailableTime>>(
        'GET',
        '/event_type_available_times',
        undefined,
        {
          event_type: eventTypeUri,
          start_time: startTime,
          end_time: endTime,
        }
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data.collection);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to get Calendly available times',
        true
      );
    }
  }

  // ==========================================================================
  // Scheduling Operations
  // ==========================================================================

  /**
   * Create a one-off scheduling link for an event type.
   * Calendly does not support direct event creation via API; instead,
   * we create a single-use scheduling link that can be sent to the invitee.
   *
   * @param eventTypeUri - The event type's URI
   * @param maxEventCount - Maximum number of events (default: 1 for single-use)
   */
  async createSchedulingLink(
    eventTypeUri: string,
    maxEventCount: number = 1
  ): Promise<IntegrationResult<{ bookingUrl: string; owner: string; ownerType: string }>> {
    try {
      const res = await this.request<{
        resource: {
          booking_url: string;
          owner: string;
          owner_type: string;
        };
      }>('POST', '/scheduling_links', {
        max_event_count: maxEventCount,
        owner: eventTypeUri,
        owner_type: 'EventType',
      });

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success({
        bookingUrl: res.data.resource.booking_url,
        owner: res.data.resource.owner,
        ownerType: res.data.resource.owner_type,
      });
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to create Calendly scheduling link',
        true
      );
    }
  }

  // ==========================================================================
  // Scheduled Event Operations
  // ==========================================================================

  /**
   * Get a scheduled event by URI.
   * @param eventUri - The scheduled event's full URI
   */
  async getScheduledEvent(eventUri: string): Promise<IntegrationResult<CalendlyScheduledEvent>> {
    try {
      // Extract UUID from URI if full URI is provided
      const uuid = eventUri.includes('/') ? eventUri.split('/').pop()! : eventUri;
      const res = await this.request<{ resource: CalendlyScheduledEvent }>(
        'GET',
        `/scheduled_events/${uuid}`
      );

      if (!res.ok) {
        if (res.status === 404) return this.error('Scheduled event not found', false);
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data.resource);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to get Calendly scheduled event',
        true
      );
    }
  }

  /**
   * List invitees for a scheduled event.
   * @param eventUuid - The scheduled event's UUID
   */
  async listEventInvitees(eventUuid: string): Promise<IntegrationResult<CalendlyInvitee[]>> {
    try {
      const res = await this.request<CalendlyCollectionResponse<CalendlyInvitee>>(
        'GET',
        `/scheduled_events/${eventUuid}/invitees`
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data.collection);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to list Calendly invitees',
        true
      );
    }
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate the integration config by testing the API token.
   */
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      this.getToken();
    } catch {
      errors.push('No API Key configured');
      return { valid: false, errors };
    }

    const res = await this.request<{ resource: CalendlyUser }>('GET', '/users/me');
    if (!res.ok) {
      errors.push(`API token validation failed: ${res.error}`);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  // ==========================================================================
  // Meta Helpers
  // ==========================================================================

  getSchedulingUrls(): Record<string, string> {
    return this.meta?.schedulingUrls ?? {};
  }
}
