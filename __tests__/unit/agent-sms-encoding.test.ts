/**
 * SMS Encoding Tests
 *
 * Priority: P1 - High
 * If broken: SMS costs triple from UCS-2 encoding, or messages garbled
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeForGsm7,
  isGsm7Compatible,
  estimateSegments,
  shouldSanitizeSms,
} from '@/app/_lib/agent/sms-encoding';

describe('sanitizeForGsm7', () => {
  it('maps curly single and double quotes to straight quotes', () => {
    const input = '\u2018outer\u2019 \u201Cinner\u201D';
    expect(sanitizeForGsm7(input)).toBe("'outer' \"inner\"");
  });

  it('maps em dash to hyphen', () => {
    expect(sanitizeForGsm7('before\u2014after')).toBe('before-after');
  });

  it('maps horizontal ellipsis to three dots', () => {
    expect(sanitizeForGsm7('wait\u2026')).toBe('wait...');
  });

  it('strips emoji', () => {
    expect(sanitizeForGsm7('Hello 😀 world')).toBe('Hello world');
    expect(sanitizeForGsm7('😀')).toBe('');
  });

  it('leaves pure ASCII text unchanged', () => {
    expect(sanitizeForGsm7('Hello world 123')).toBe('Hello world 123');
  });
});

describe('isGsm7Compatible', () => {
  it('returns true for plain GSM-7 ASCII like Hello world', () => {
    expect(isGsm7Compatible('Hello world')).toBe(true);
  });

  it('returns false when emoji is present', () => {
    expect(isGsm7Compatible('Hello 😀')).toBe(false);
  });

  it('returns false for curly double quotes', () => {
    expect(isGsm7Compatible('He said \u201Chi\u201D')).toBe(false);
  });
});

describe('estimateSegments', () => {
  it('counts a short GSM-7 string as one segment', () => {
    expect(estimateSegments('Hello')).toEqual({
      encoding: 'gsm7',
      segments: 1,
      characters: 5,
    });
  });

  it('uses multi-segment GSM-7 limits after 160 septets', () => {
    const text = 'a'.repeat(161);
    expect(estimateSegments(text)).toEqual({
      encoding: 'gsm7',
      segments: 2,
      characters: 161,
    });
  });

  it('uses UCS-2 when non-GSM characters force Unicode encoding', () => {
    const text = 'Hi 😀';
    expect(estimateSegments(text)).toEqual({
      encoding: 'ucs2',
      segments: 1,
      characters: text.length,
    });
  });
});

describe('shouldSanitizeSms', () => {
  it('returns true for SMS channel', () => {
    expect(shouldSanitizeSms('SMS')).toBe(true);
  });

  it('returns false for null', () => {
    expect(shouldSanitizeSms(null)).toBe(false);
  });

  it('returns false for non-SMS channels like WEB_CHAT', () => {
    expect(shouldSanitizeSms('WEB_CHAT')).toBe(false);
  });
});
