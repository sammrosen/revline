/**
 * Google Calendar Integration Adapter
 *
 * Handles Google Calendar API operations for a specific workspace.
 * Uses OAuth2 refresh token flow for authentication.
 *
 * Secret names:
 * - "Client ID" - OAuth2 client_id from Google Cloud Console
 * - "Client Secret" - OAuth2 client_secret from Google Cloud Console
 * - "Refresh Token" - OAuth2 refresh token from authorization flow
 *
 * Meta:
 * - calendarId - Google Calendar ID (default: "primary")
 * - timezone - IANA timezone string
 * - defaultDuration - Default appointment duration in minutes
 *
 * STANDARDS:
 * - All operations auto-update health status
 * - Returns structured IntegrationResult for all operations
 * - Never exposes credentials outside this module
 * - Secrets decrypted only at point-of-use via getSecret()
 * - See docs/STANDARDS.md for full requirements
 */

import { IntegrationType } from '@prisma/client';
import { BaseIntegrationAdapter } from './base';
import { GoogleCalendarMeta, IntegrationResult } from '@/app/_lib/types';

export const GOOGLE_CLIENT_ID_SECRET = 'Client ID';
export const GOOGLE_CLIENT_SECRET_SECRET = 'Client Secret';
export const GOOGLE_REFRESH_TOKEN_SECRET = 'Refresh Token';

const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_TIMEOUT_MS = 30_000;

// ============================================================================
// Types
// ============================================================================

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: string;
  attendees?: GoogleCalendarAttendee[];
  location?: string;
  htmlLink?: string;
  created: string;
  updated: string;
}

export interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  self?: boolean;
}

export interface GoogleFreeBusyResponse {
  kind: string;
  timeMin: string;
  timeMax: string;
  calendars: Record<string, {
    busy: Array<{ start: string; end: string }>;
    errors?: Array<{ domain: string; reason: string }>;
  }>;
}

interface GoogleCalendarEventList {
  kind: string;
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface GoogleApiError {
  error: {
    code: number;
    message: string;
    errors?: Array<{ message: string; domain: string; reason: string }>;
  };
}

export interface InsertEventParams {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
  timeZone?: string;
}

// ============================================================================
// Adapter
// ============================================================================

export class GoogleCalendarAdapter extends BaseIntegrationAdapter<GoogleCalendarMeta> {
  readonly type = IntegrationType.GOOGLE_CALENDAR;

  /** Cached access token and expiry */
  private cachedAccessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  static async forWorkspace(workspaceId: string): Promise<GoogleCalendarAdapter | null> {
    const data = await BaseIntegrationAdapter.loadAdapter<GoogleCalendarMeta>(
      workspaceId,
      IntegrationType.GOOGLE_CALENDAR
    );

    if (!data) return null;

    // Verify all required secrets exist
    const secretNames = data.secrets.map(s => s.name);
    const requiredSecrets = [GOOGLE_CLIENT_ID_SECRET, GOOGLE_CLIENT_SECRET_SECRET, GOOGLE_REFRESH_TOKEN_SECRET];
    const missing = requiredSecrets.filter(s => !secretNames.includes(s));
    if (missing.length > 0) {
      console.warn('Google Calendar integration missing secrets:', { workspaceId, missing });
      return null;
    }

    return new GoogleCalendarAdapter(workspaceId, data.secrets, data.meta);
  }

  static async forClient(clientId: string): Promise<GoogleCalendarAdapter | null> {
    return GoogleCalendarAdapter.forWorkspace(clientId);
  }

  // ==========================================================================
  // Token Management
  // ==========================================================================

  /**
   * Get a valid access token, refreshing if needed.
   * Caches token in memory until expiry (with 60s buffer).
   */
  private async getAccessToken(): Promise<IntegrationResult<string>> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.success(this.cachedAccessToken);
    }

    const clientId = this.getSecret(GOOGLE_CLIENT_ID_SECRET);
    const clientSecret = this.getSecret(GOOGLE_CLIENT_SECRET_SECRET);
    const refreshToken = this.getSecret(GOOGLE_REFRESH_TOKEN_SECRET);

    if (!clientId || !clientSecret || !refreshToken) {
      return this.error('Missing OAuth2 credentials', false);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);

    try {
      const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({})) as GoogleApiError;
        const msg = errorBody.error?.message || `Token refresh failed: ${res.status}`;
        await this.markUnhealthy();
        return this.error(msg, res.status >= 500);
      }

      const tokenData = await res.json() as GoogleTokenResponse;
      this.cachedAccessToken = tokenData.access_token;
      // Cap cache TTL to 5 minutes per standards (Google returns ~3600s)
      const cacheTtlMs = Math.min(tokenData.expires_in - 60, 300) * 1000;
      this.tokenExpiresAt = Date.now() + cacheTtlMs;

      return this.success(tokenData.access_token);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return this.error('Token refresh timed out', true);
      }
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to refresh access token',
        true
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  // ==========================================================================
  // API Client
  // ==========================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; retryable: boolean; retryAfterMs?: number }> {
    const tokenResult = await this.getAccessToken();
    if (!tokenResult.success || !tokenResult.data) {
      return { ok: false, error: tokenResult.error || 'Failed to get access token', status: 0, retryable: false };
    }

    const url = new URL(`${GOOGLE_CALENDAR_API_BASE}${path}`);
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT_MS);

    try {
      const res = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${tokenResult.data}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
        return { ok: false, error: 'Rate limited by Google Calendar', status: 429, retryable: true, retryAfterMs };
      }

      if (res.status === 401) {
        // Token may have been revoked — invalidate cache
        this.cachedAccessToken = null;
        this.tokenExpiresAt = 0;
        return { ok: false, error: 'Access token expired or revoked', status: 401, retryable: false };
      }

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({})) as GoogleApiError;
        return {
          ok: false,
          error: errorBody.error?.message || `Google Calendar API error: ${res.status}`,
          status: res.status,
          retryable: res.status >= 500,
        };
      }

      // Handle 204 No Content
      if (res.status === 204) {
        // 204 No Content: cast to T since callers (deleteEvent) expect void
        return { ok: true, data: undefined as unknown as T };
      }

      const json = await res.json() as T;
      return { ok: true, data: json };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, error: 'Google Calendar API request timed out', status: 0, retryable: true };
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
  // FreeBusy Operations
  // ==========================================================================

  /**
   * Query free/busy information for the calendar.
   * Returns busy time ranges within the requested window.
   *
   * @param timeMin - ISO 8601 start time
   * @param timeMax - ISO 8601 end time
   */
  async getFreeBusy(
    timeMin: string,
    timeMax: string
  ): Promise<IntegrationResult<Array<{ start: string; end: string }>>> {
    const calendarId = this.getCalendarId();

    try {
      const res = await this.request<GoogleFreeBusyResponse>(
        'POST',
        '/freeBusy',
        {
          timeMin,
          timeMax,
          timeZone: this.getTimezone(),
          items: [{ id: calendarId }],
        }
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      const calendarData = res.data.calendars[calendarId];
      if (!calendarData) {
        return this.success([]);
      }

      if (calendarData.errors && calendarData.errors.length > 0) {
        await this.markUnhealthy();
        return this.error(
          `FreeBusy errors: ${calendarData.errors.map(e => e.reason).join(', ')}`,
          true
        );
      }

      await this.touch();
      return this.success(calendarData.busy);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to query free/busy',
        true
      );
    }
  }

  // ==========================================================================
  // Event Operations
  // ==========================================================================

  /**
   * List events in the calendar within a time range.
   *
   * @param timeMin - ISO 8601 start time
   * @param timeMax - ISO 8601 end time
   */
  async listEvents(
    timeMin: string,
    timeMax: string
  ): Promise<IntegrationResult<GoogleCalendarEvent[]>> {
    const calendarId = this.getCalendarId();

    try {
      const res = await this.request<GoogleCalendarEventList>(
        'GET',
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        undefined,
        {
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '250',
        }
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data.items || []);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to list Google Calendar events',
        true
      );
    }
  }

  /**
   * Insert a new event into the calendar.
   *
   * @param params - Event parameters
   */
  async insertEvent(params: InsertEventParams): Promise<IntegrationResult<GoogleCalendarEvent>> {
    const calendarId = this.getCalendarId();
    const timeZone = params.timeZone || this.getTimezone();

    try {
      const eventBody: Record<string, unknown> = {
        summary: params.summary,
        start: {
          dateTime: params.startTime,
          timeZone,
        },
        end: {
          dateTime: params.endTime,
          timeZone,
        },
      };

      if (params.description) eventBody.description = params.description;
      if (params.location) eventBody.location = params.location;
      if (params.attendees) {
        eventBody.attendees = params.attendees.map(a => ({
          email: a.email,
          displayName: a.displayName,
        }));
      }

      const res = await this.request<GoogleCalendarEvent>(
        'POST',
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        eventBody
      );

      if (!res.ok) {
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(res.data);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to insert Google Calendar event',
        true
      );
    }
  }

  /**
   * Delete an event from the calendar.
   *
   * @param eventId - Google Calendar event ID
   */
  async deleteEvent(eventId: string): Promise<IntegrationResult<void>> {
    const calendarId = this.getCalendarId();

    try {
      const res = await this.request<void>(
        'DELETE',
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
      );

      if (!res.ok) {
        if (res.status === 404) return this.success(undefined);
        await this.markUnhealthy();
        return this.error(res.error, res.retryable, res.retryAfterMs);
      }

      await this.touch();
      return this.success(undefined);
    } catch (err) {
      await this.markUnhealthy();
      return this.error(
        err instanceof Error ? err.message : 'Failed to delete Google Calendar event',
        true
      );
    }
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate the integration config by testing the OAuth2 token exchange.
   */
  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check secrets exist
    if (!this.hasSecret(GOOGLE_CLIENT_ID_SECRET)) errors.push('No Client ID configured');
    if (!this.hasSecret(GOOGLE_CLIENT_SECRET_SECRET)) errors.push('No Client Secret configured');
    if (!this.hasSecret(GOOGLE_REFRESH_TOKEN_SECRET)) errors.push('No Refresh Token configured');

    if (errors.length > 0) return { valid: false, errors };

    // Test token exchange
    const tokenResult = await this.getAccessToken();
    if (!tokenResult.success) {
      errors.push(`Token exchange failed: ${tokenResult.error}`);
      return { valid: false, errors };
    }

    // Test calendar access
    const calendarId = this.getCalendarId();
    const res = await this.request<GoogleCalendarEventList>(
      'GET',
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      undefined,
      { maxResults: '1' }
    );

    if (!res.ok) {
      errors.push(`Calendar access failed: ${res.error}`);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  // ==========================================================================
  // Meta Helpers
  // ==========================================================================

  getCalendarId(): string {
    return this.meta?.calendarId ?? 'primary';
  }

  getTimezone(): string {
    return this.meta?.timezone ?? 'UTC';
  }

  getDefaultDuration(): number {
    return this.meta?.defaultDuration ?? 30;
  }
}
