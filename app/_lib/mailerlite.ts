/**
 * MailerLite API Helper Functions
 * Reusable functions for interacting with the MailerLite API
 */

const MAILERLITE_API_URL = 'https://connect.mailerlite.com/api';
const API_VERSION = '2024-11-20';

interface AddSubscriberParams {
  email: string;
  name?: string;
  groupId: string;
  apiKey: string;
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
}: AddSubscriberParams): Promise<MailerLiteResponse> {
  try {
    const response = await fetch(`${MAILERLITE_API_URL}/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Version': API_VERSION,
      },
      body: JSON.stringify({
        email,
        fields: {
          name: name || '',
        },
        groups: [groupId],
        status: 'active',
      }),
    });

    // Log rate limit info
    const rateRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimit = response.headers.get('X-RateLimit-Limit');
    
    if (rateRemaining && parseInt(rateRemaining) < 10) {
      console.warn(`MailerLite rate limit warning: ${rateRemaining}/${rateLimit} requests remaining`);
    }

    const data = await response.json();

    if (!response.ok) {
      // Handle duplicate subscriber (422 validation error)
      if (response.status === 422 && data.message?.toLowerCase().includes('already')) {
        return {
          success: true,
          message: 'Subscriber already exists',
          subscriberId: data.data?.id,
        };
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        return {
          success: false,
          error: `Rate limit exceeded. Retry after ${retryAfter || 60} seconds.`,
        };
      }

      console.error('MailerLite API error:', {
        status: response.status,
        data,
      });

      return {
        success: false,
        error: data.message || 'Failed to add subscriber',
      };
    }

    return {
      success: true,
      message: 'Successfully added subscriber',
      subscriberId: data.data?.id,
    };
  } catch (error) {
    console.error('MailerLite API request failed:', error);
    return {
      success: false,
      error: 'Network error or API unavailable',
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

