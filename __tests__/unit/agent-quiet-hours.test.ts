/**
 * Quiet Hours Tests
 *
 * Priority: P1 - High
 * If broken: Messages sent outside TCPA-compliant hours
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkSendWindow,
  shouldEnforceQuietHours,
  getNextWindowOpen,
} from '@/app/_lib/agent/quiet-hours';

const TZ = 'America/New_York';

/** Parts for a fixed instant in America/New_York (24h). */
function nyParts(d: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const val = (type: string) => parts.find((p) => p.type === type)?.value;
  return {
    year: val('year')!,
    month: val('month')!,
    day: val('day')!,
    hour: parseInt(val('hour')!, 10),
    minute: parseInt(val('minute')!, 10),
  };
}

describe('shouldEnforceQuietHours', () => {
  it("returns true for 'SMS'", () => {
    expect(shouldEnforceQuietHours('SMS')).toBe(true);
  });

  it("returns false for 'EMAIL'", () => {
    expect(shouldEnforceQuietHours('EMAIL')).toBe(false);
  });

  it('returns false for null', () => {
    expect(shouldEnforceQuietHours(null)).toBe(false);
  });

  it("normalizes channel type with toUpperCase — 'sms' enforces quiet hours", () => {
    expect(shouldEnforceQuietHours('sms')).toBe(true);
  });
});

describe('checkSendWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows sends at 2 PM Eastern', () => {
    vi.setSystemTime(new Date('2025-01-15T19:00:00.000Z'));
    const result = checkSendWindow(TZ);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('within_window');
    expect(result.localHour).toBe(14);
    expect(result.nextWindowAt).toBeNull();
  });

  it('blocks sends at 7 AM Eastern (before 9 AM)', () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    const result = checkSendWindow(TZ);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_window');
    expect(result.localHour).toBe(7);
    expect(result.nextWindowAt).toBeInstanceOf(Date);
  });

  it('blocks sends at 9 PM Eastern (after 8 PM end)', () => {
    vi.setSystemTime(new Date('2025-01-16T02:00:00.000Z'));
    const result = checkSendWindow(TZ);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_window');
    expect(result.localHour).toBe(21);
    expect(result.nextWindowAt).toBeInstanceOf(Date);
  });

  it('blocks sends at midnight Eastern', () => {
    vi.setSystemTime(new Date('2025-01-15T05:00:00.000Z'));
    const result = checkSendWindow(TZ);
    expect(result.allowed).toBe(false);
    expect(result.localHour).toBe(0);
  });

  it('respects custom window: 9 AM Eastern is outside 10–18', () => {
    vi.setSystemTime(new Date('2025-01-15T14:00:00.000Z'));
    const result = checkSendWindow(TZ, { startHour: 10, endHour: 18 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_window');
    expect(result.localHour).toBe(9);
  });

  it('does not throw for invalid timezone and falls back safely', () => {
    vi.setSystemTime(new Date('2025-01-15T19:00:00.000Z'));
    expect(() => checkSendWindow('Invalid/Timezone')).not.toThrow();
    const result = checkSendWindow('Invalid/Timezone');
    expect(result).toMatchObject({
      allowed: expect.any(Boolean),
      reason: expect.stringMatching(/within_window|outside_window/),
      localHour: expect.any(Number),
      localMinute: expect.any(Number),
    });
    // Fallback is America/New_York — same instant should read as 2 PM local
    expect(result.localHour).toBe(14);
    expect(result.allowed).toBe(true);
  });
});

describe('getNextWindowOpen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('at 10 PM Eastern returns next calendar day at 9 AM Eastern', () => {
    vi.setSystemTime(new Date('2025-01-16T03:00:00.000Z'));
    const next = getNextWindowOpen(TZ);
    const p = nyParts(next);
    expect(p.hour).toBe(9);
    expect(p.minute).toBe(0);
    expect(p.year).toBe('2025');
    expect(p.month).toBe('01');
    expect(p.day).toBe('16');
  });

  it('at 7 AM Eastern returns same calendar day at 9 AM Eastern', () => {
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
    const next = getNextWindowOpen(TZ);
    const p = nyParts(next);
    expect(p.hour).toBe(9);
    expect(p.minute).toBe(0);
    expect(p.year).toBe('2025');
    expect(p.month).toBe('01');
    expect(p.day).toBe('15');
  });
});
