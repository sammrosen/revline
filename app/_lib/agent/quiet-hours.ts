/**
 * Quiet Hours Send Gate
 *
 * TCPA-compliant send window enforcement for outbound messages.
 * Pure functions — no DB access, no side effects, easily testable.
 *
 * Legal basis:
 * - Federal TCPA prohibits marketing messages before 8 AM / after 9 PM local time
 * - Strictest state rules (FL, OK, WA, MD) restrict to 8 AM–8 PM
 * - Default window of 9 AM–8 PM buffers against all known state rules
 * - Reactive sends (responding to user-initiated contact) are NOT marketing under TCPA
 *   but we log them for audit trail
 *
 * STANDARDS:
 * - Abstraction First: standalone module, engine calls one function
 * - Channel-Agnostic: only SMS enforces quiet hours; extensible via QUIET_HOURS_CHANNELS set
 * - Fail-Safe: invalid timezone falls back to America/New_York, never crashes
 */

const DEFAULT_START_HOUR = 9;  // 9 AM
const DEFAULT_END_HOUR = 20;   // 8 PM
const FALLBACK_TIMEZONE = 'America/New_York';

const QUIET_HOURS_CHANNELS: Set<string> = new Set(['SMS']);

export type SendType = 'reactive' | 'proactive';

export interface SendWindowConfig {
  startHour: number;
  endHour: number;
}

export interface SendGateResult {
  allowed: boolean;
  reason: 'within_window' | 'outside_window';
  localHour: number;
  localMinute: number;
  nextWindowAt: Date | null;
}

export interface SendReplyResult {
  sent: boolean;
  blockedByQuietHours?: boolean;
  nextWindowAt?: Date;
}

/**
 * Get the current hour and minute in a given IANA timezone.
 * Falls back to America/New_York on invalid timezone strings.
 */
function getLocalTime(timezone: string): { hour: number; minute: number; validTimezone: string } {
  let tz = timezone;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return { hour, minute, validTimezone: tz };
  } catch {
    tz = FALLBACK_TIMEZONE;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return { hour, minute, validTimezone: tz };
  }
}

/**
 * Check whether the current time is within the allowed send window
 * for a given timezone.
 */
export function checkSendWindow(
  timezone: string,
  config?: SendWindowConfig
): SendGateResult {
  const startHour = config?.startHour ?? DEFAULT_START_HOUR;
  const endHour = config?.endHour ?? DEFAULT_END_HOUR;
  const { hour, minute, validTimezone } = getLocalTime(timezone);

  const withinWindow = hour >= startHour && hour < endHour;

  return {
    allowed: withinWindow,
    reason: withinWindow ? 'within_window' : 'outside_window',
    localHour: hour,
    localMinute: minute,
    nextWindowAt: withinWindow ? null : getNextWindowOpen(validTimezone, config),
  };
}

/**
 * Whether a channel type requires quiet hours enforcement.
 * Extensibility point: add channel strings to the set for new channels.
 */
export function shouldEnforceQuietHours(channelType: string | null): boolean {
  if (!channelType) return false;
  return QUIET_HOURS_CHANNELS.has(channelType.toUpperCase());
}

/**
 * Calculate the next Date when the send window opens.
 * If we're before today's window, returns today at startHour.
 * If we're after today's window, returns tomorrow at startHour.
 */
export function getNextWindowOpen(
  timezone: string,
  config?: SendWindowConfig
): Date {
  const startHour = config?.startHour ?? DEFAULT_START_HOUR;
  const { hour, validTimezone } = getLocalTime(timezone);

  // Build a Date object for the target local time using timezone offset math.
  // We compute the offset between UTC and the target timezone, then construct
  // the Date in UTC that corresponds to the desired local time.
  const now = new Date();

  const localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  // localDateStr is "YYYY-MM-DD" in the target timezone
  const [year, month, day] = localDateStr.split('-').map(Number);

  // If current hour is before start, window opens today; otherwise tomorrow
  const targetDay = hour < startHour ? day : day + 1;

  // Build a rough target in UTC by creating the local datetime string
  // and computing the actual UTC offset for the timezone
  const candidateLocal = new Date(year, month - 1, targetDay, startHour, 0, 0, 0);

  // Compute the offset: difference between UTC and local interpretation
  const utcEquivalent = new Date(candidateLocal.toLocaleString('en-US', { timeZone: 'UTC' }));
  const localEquivalent = new Date(candidateLocal.toLocaleString('en-US', { timeZone: validTimezone }));
  const offsetMs = utcEquivalent.getTime() - localEquivalent.getTime();

  return new Date(candidateLocal.getTime() + offsetMs);
}
