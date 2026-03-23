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
    let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    if (hour === 24) hour = 0; // en-US + hour12:false may use 24 for midnight
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
    let hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    if (hour === 24) hour = 0;
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    return { hour, minute, validTimezone: tz };
  }
}

/**
 * UTC instant when the wall-clock reads (year, month, day, hour, minute) in `timeZone`.
 * Scans a ±2 day UTC range by minute — correct across DST; 9:00 etc. always exists.
 */
function utcInstantForZonedWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const read = (utcMs: number) => {
    const parts = formatter.formatToParts(new Date(utcMs));
    const g = (type: string) => parts.find((p) => p.type === type)?.value;
    let hh = parseInt(g('hour') || '0', 10);
    if (hh === 24) hh = 0;
    return {
      y: parseInt(g('year') || '0', 10),
      mo: parseInt(g('month') || '0', 10),
      d: parseInt(g('day') || '0', 10),
      h: hh,
      mi: parseInt(g('minute') || '0', 10),
    };
  };

  const lo = Date.UTC(year, month - 1, day - 1, 0, 0, 0, 0);
  const hi = Date.UTC(year, month - 1, day + 2, 0, 0, 0, 0);

  for (let t = lo; t <= hi; t += 60 * 1000) {
    const p = read(t);
    if (p.y === year && p.mo === month && p.d === day && p.h === hour && p.mi === minute) {
      return new Date(t);
    }
  }

  // Last resort: same scan by second (handles edge cases where minute step lands oddly)
  for (let t = lo; t <= hi; t += 1000) {
    const p = read(t);
    if (p.y === year && p.mo === month && p.d === day && p.h === hour && p.mi === minute) {
      return new Date(t);
    }
  }

  return new Date(Date.UTC(year, month - 1, day, hour + 12, minute, 0, 0));
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

  const now = new Date();

  const localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const [y0, m0, d0] = localDateStr.split('-').map(Number);

  let y: number;
  let mo: number;
  let d: number;
  if (hour < startHour) {
    y = y0;
    mo = m0;
    d = d0;
  } else {
    const nextCal = new Date(Date.UTC(y0, m0 - 1, d0 + 1));
    y = nextCal.getUTCFullYear();
    mo = nextCal.getUTCMonth() + 1;
    d = nextCal.getUTCDate();
  }

  return utcInstantForZonedWallClock(y, mo, d, startHour, 0, validTimezone);
}
