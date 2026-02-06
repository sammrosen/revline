/**
 * MailerLite API Helper Functions
 * 
 * Reusable functions for interacting with the MailerLite API.
 * Uses resilient HTTP client for timeouts, retries, and backoff.
 * 
 * STANDARDS:
 * - All API calls use resilientFetch with smart retry logic
 * - Rate limits are respected via Retry-After header
 * - Duplicate subscribers are handled gracefully (not an error)
 */

import { resilientFetch, logStructured } from '@/app/_lib/reliability';

const MAILERLITE_API_URL = 'https://connect.mailerlite.com/api';
const API_VERSION = '2024-11-20';

// Default resilience options for MailerLite
const MAILERLITE_FETCH_OPTIONS = {
  timeout: 10000,   // 10 second per-request timeout
  deadline: 30000,  // 30 second total deadline
  retries: 3,       // 3 retry attempts
  backoffMs: 1000,  // 1 second initial backoff
  jitter: true,
};

interface AddSubscriberParams {
  email: string;
  name?: string;
  groupId: string;
  apiKey: string;
  /** Custom subscriber fields to set (e.g., { barcode: "ABC123", member_type: "fit1" }) */
  fields?: Record<string, unknown>;
}

interface MailerLiteResponse {
  success: boolean;
  message?: string;
  subscriberId?: string;
  error?: string;
}

/**
 * Add a subscriber to a MailerLite group
 * Handles duplicates gracefully and returns structured response
 */
export async function addSubscriberToGroup({
  email,
  name,
  groupId,
  apiKey,
  fields: customFields,
}: AddSubscriberParams): Promise<MailerLiteResponse> {
  const correlationId = crypto.randomUUID();
  
  try {
    // Build subscriber fields: name + any custom fields from lead properties
    const subscriberFields: Record<string, unknown> = {
      name: name || '',
      ...customFields,
    };

    const { response, attempts, totalTimeMs } = await resilientFetch(
      `${MAILERLITE_API_URL}/subscribers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Version': API_VERSION,
        },
        body: JSON.stringify({
          email,
          fields: subscriberFields,
          groups: [groupId],
          status: 'active',
        }),
      },
      MAILERLITE_FETCH_OPTIONS
    );

    // Log rate limit info
    const rateRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimit = response.headers.get('X-RateLimit-Limit');
    
    if (rateRemaining && parseInt(rateRemaining) < 10) {
      logStructured({
        correlationId,
        event: 'mailerlite_rate_limit_warning',
        metadata: { 
          remaining: rateRemaining, 
          limit: rateLimit,
          attempts,
          totalTimeMs,
        },
      });
    }

    const data = await response.json();

    if (!response.ok) {
      // Handle duplicate subscriber (422 validation error)
      if (response.status === 422 && data.message?.toLowerCase().includes('already')) {
        logStructured({
          correlationId,
          event: 'mailerlite_subscriber_exists',
          success: true,
          metadata: { email, groupId, attempts, totalTimeMs },
        });
        return {
          success: true,
          message: 'Subscriber already exists',
          subscriberId: data.data?.id,
        };
      }

      // Handle rate limiting (shouldn't happen with resilientFetch, but just in case)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        logStructured({
          correlationId,
          event: 'mailerlite_rate_limited',
          success: false,
          error: `Rate limit exceeded`,
          metadata: { retryAfter, attempts, totalTimeMs },
        });
        return {
          success: false,
          error: `Rate limit exceeded. Retry after ${retryAfter || 60} seconds.`,
        };
      }

      logStructured({
        correlationId,
        event: 'mailerlite_api_error',
        success: false,
        error: data.message || 'API error',
        metadata: { status: response.status, attempts, totalTimeMs },
      });

      return {
        success: false,
        error: data.message || 'Failed to add subscriber',
      };
    }

    logStructured({
      correlationId,
      event: 'mailerlite_subscriber_added',
      success: true,
      metadata: { email, groupId, subscriberId: data.data?.id, attempts, totalTimeMs },
    });

    return {
      success: true,
      message: 'Successfully added subscriber',
      subscriberId: data.data?.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logStructured({
      correlationId,
      event: 'mailerlite_api_failure',
      success: false,
      error: errorMessage,
    });
    
    return {
      success: false,
      error: `MailerLite API error: ${errorMessage}`,
    };
  }
}

/**
 * Validate that required MailerLite configuration exists
 */
export function validateMailerLiteConfig(apiKey?: string, groupId?: string): {
  valid: boolean;
  error?: string;
} {
  if (!apiKey) {
    return {
      valid: false,
      error: 'MailerLite API key is not configured',
    };
  }

  if (!groupId) {
    return {
      valid: false,
      error: 'MailerLite group ID is not configured',
    };
  }

  return { valid: true };
}

/**
 * MailerLite Insights API Types
 */
export interface MailerLiteGroup {
  id: string;
  name: string;
  active_count: number;
  sent_count?: number;
  unsubscribed_count?: number;
  unconfirmed_count?: number;
  bounced_count?: number;
}

export interface AutomationStep {
  id: string;
  type: 'delay' | 'email' | 'condition' | 'split' | 'action';
  description: string;
  parent_id: string | null;
  complete?: boolean;
  // Email-specific fields
  name?: string;
  subject?: string;
  from?: string;
  from_name?: string;
  // Delay-specific fields
  unit?: string;
  value?: string;
}

export interface AutomationTrigger {
  id: string;
  type: string;
  group_ids: string[];
  groups: { id: string; name: string }[];
  exclude_group_ids?: string[];
  excluded_groups?: { id: string; name: string }[];
  broken: boolean;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  triggers: AutomationTrigger[];
  steps: AutomationStep[];
  complete: boolean;
  broken: boolean;
  warnings: string[];
  emails_count: number;
  stats: {
    sent: number;
    open_rate: { float: number; string: string };
    click_rate: { float: number; string: string };
    completed_subscribers_count: number;
    subscribers_in_queue_count: number;
    bounce_rate?: { float: number; string: string };
    click_to_open_rate?: { float: number; string: string };
  };
  created_at: string;
}

/**
 * Get all groups from MailerLite account
 */
export async function getMailerLiteGroups(apiKey: string): Promise<MailerLiteGroup[]> {
  try {
    const { response } = await resilientFetch(
      `${MAILERLITE_API_URL}/groups`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Version': API_VERSION,
        },
      },
      MAILERLITE_FETCH_OPTIONS
    );

    if (!response.ok) {
      console.error('MailerLite groups API error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch MailerLite groups:', error);
    return [];
  }
}

/**
 * Get all automations from MailerLite account
 */
export async function getAllAutomations(apiKey: string): Promise<Automation[]> {
  try {
    const { response } = await resilientFetch(
      `${MAILERLITE_API_URL}/automations?limit=100`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Version': API_VERSION,
        },
      },
      MAILERLITE_FETCH_OPTIONS
    );

    if (!response.ok) {
      console.error('MailerLite automations API error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch MailerLite automations:', error);
    return [];
  }
}

/**
 * Get automations triggered by a specific group
 */
export async function getAutomationsByGroup(
  apiKey: string,
  groupId: string
): Promise<Automation[]> {
  try {
    const { response } = await resilientFetch(
      `${MAILERLITE_API_URL}/automations?filter[group]=${groupId}&limit=100`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Version': API_VERSION,
        },
      },
      MAILERLITE_FETCH_OPTIONS
    );

    if (!response.ok) {
      console.error('MailerLite automations by group API error:', response.status);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch MailerLite automations by group:', error);
    return [];
  }
}
