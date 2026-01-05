/**
 * Pushover Notification Module
 * 
 * Simple wrapper for the Pushover push notification API.
 * Used for sending admin alerts to mobile devices.
 * 
 * Setup:
 * 1. Create an app at https://pushover.net/apps/build
 * 2. Copy the API Token to PUSHOVER_APP_TOKEN
 * 3. Copy your User Key from https://pushover.net/ to PUSHOVER_USER_KEY
 */

const PUSHOVER_API_URL = 'https://api.pushover.net/1/messages.json';

export interface PushoverOptions {
  /** The notification message (required, max 1024 chars) */
  message: string;
  /** Optional title (max 250 chars, defaults to app name) */
  title?: string;
  /** Message priority: -2 (lowest) to 2 (emergency) */
  priority?: -2 | -1 | 0 | 1 | 2;
  /** Notification sound (e.g., 'pushover', 'cosmic', 'none') */
  sound?: string;
  /** Supplementary URL to include */
  url?: string;
  /** Title for the URL */
  urlTitle?: string;
}

export interface PushoverResult {
  success: boolean;
  error?: string;
  requestId?: string;
}

/**
 * Check if Pushover is configured
 */
export function isPushoverConfigured(): boolean {
  return !!(process.env.PUSHOVER_USER_KEY && process.env.PUSHOVER_APP_TOKEN);
}

/**
 * Send a push notification via Pushover
 * 
 * @example
 * const result = await sendPushoverNotification({
 *   message: 'Test notification received for ClientName',
 *   title: 'RevLine Alert',
 * });
 */
export async function sendPushoverNotification(
  options: PushoverOptions
): Promise<PushoverResult> {
  const userKey = process.env.PUSHOVER_USER_KEY;
  const appToken = process.env.PUSHOVER_APP_TOKEN;

  if (!userKey || !appToken) {
    return {
      success: false,
      error: 'Pushover not configured. Set PUSHOVER_USER_KEY and PUSHOVER_APP_TOKEN.',
    };
  }

  // Validate message length
  if (!options.message || options.message.length === 0) {
    return {
      success: false,
      error: 'Message is required',
    };
  }

  if (options.message.length > 1024) {
    return {
      success: false,
      error: 'Message exceeds 1024 character limit',
    };
  }

  if (options.title && options.title.length > 250) {
    return {
      success: false,
      error: 'Title exceeds 250 character limit',
    };
  }

  try {
    const body: Record<string, string | number> = {
      token: appToken,
      user: userKey,
      message: options.message,
    };

    if (options.title) {
      body.title = options.title;
    }

    if (options.priority !== undefined) {
      body.priority = options.priority;
    }

    if (options.sound) {
      body.sound = options.sound;
    }

    if (options.url) {
      body.url = options.url;
    }

    if (options.urlTitle) {
      body.url_title = options.urlTitle;
    }

    const response = await fetch(PUSHOVER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as {
      status: number;
      request: string;
      errors?: string[];
    };

    if (data.status === 1) {
      return {
        success: true,
        requestId: data.request,
      };
    }

    return {
      success: false,
      error: data.errors?.join(', ') || 'Unknown Pushover error',
      requestId: data.request,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return {
      success: false,
      error: `Failed to send notification: ${message}`,
    };
  }
}

