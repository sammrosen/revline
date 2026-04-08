/**
 * SMS Encoding Sanitization
 *
 * Prevents Claude's smart quotes, emoji, and Unicode characters from
 * silently switching SMS encoding from GSM-7 (160 chars/segment) to
 * UCS-2 (70 chars/segment), which triples segment costs.
 *
 * Pure functions — no DB access, no side effects, easily testable.
 *
 * STANDARDS:
 * - Abstraction First: standalone module, engine calls sanitizeForGsm7()
 * - Channel-Agnostic: only applies to SMS via shouldSanitizeSms() check
 * - Fail-Safe: sanitization never throws; returns original text on error
 */

// GSM 03.38 basic character set + extension table
// Reference: https://en.wikipedia.org/wiki/GSM_03.38
const GSM7_BASIC_CHARS = new Set([
  // Basic character set (standard table)
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r',
  'Å', 'å', 'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ',
  'Æ', 'æ', 'ß', 'É', ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')',
  '*', '+', ',', '-', '.', '/', '0', '1', '2', '3', '4', '5', '6', '7',
  '8', '9', ':', ';', '<', '=', '>', '?', '¡', 'A', 'B', 'C', 'D', 'E',
  'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§', '¿',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n',
  'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ä', 'ö',
  'ñ', 'ü', 'à',
  // Extension table characters (each costs 2 chars in GSM-7 due to escape prefix)
  '^', '{', '}', '\\', '[', ']', '~', '|', '€',
]);

// Extension table characters cost 2 septets (escape + char) in GSM-7
const GSM7_EXTENSION_CHARS = new Set(['^', '{', '}', '\\', '[', ']', '~', '|', '€']);

const SMS_CHANNELS: Set<string> = new Set(['SMS']);

// Regex matching common emoji Unicode ranges
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{231A}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25FE}\u{2934}-\u{2935}\u{2B06}-\u{2B07}\u{2B1B}-\u{2B1C}\u{3030}\u{303D}\u{3297}\u{3299}\u{200D}\u{FE0F}\u{20E3}\u{E0020}-\u{E007F}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;

/**
 * Unicode replacement map: common non-GSM characters → GSM-7 equivalents.
 * Covers the characters Claude most frequently outputs.
 */
const UNICODE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\u2018/g, "'"],   // left single curly quote
  [/\u2019/g, "'"],   // right single curly quote (apostrophe)
  [/\u201C/g, '"'],   // left double curly quote
  [/\u201D/g, '"'],   // right double curly quote
  [/\u2013/g, '-'],   // en-dash
  [/\u2014/g, '-'],   // em-dash
  [/\u2026/g, '...'], // horizontal ellipsis
  [/\u00A0/g, ' '],   // non-breaking space
  [/\u2022/g, '-'],   // bullet point
  [/\u2010/g, '-'],   // hyphen character
  [/\u2011/g, '-'],   // non-breaking hyphen
  [/\u2012/g, '-'],   // figure dash
  [/\u2015/g, '-'],   // horizontal bar
  [/\u2032/g, "'"],   // prime (feet)
  [/\u2033/g, '"'],   // double prime (inches)
  [/\u2028/g, '\n'],  // line separator
  [/\u2029/g, '\n'],  // paragraph separator
];

/**
 * Sanitize text for GSM-7 encoding compatibility.
 * Replaces common Unicode characters with GSM-7 equivalents and strips emoji.
 * Never throws — returns original text unchanged on any error.
 */
export function sanitizeForGsm7(text: string): string {
  try {
    let result = text;

    for (const [pattern, replacement] of UNICODE_REPLACEMENTS) {
      result = result.replace(pattern, replacement);
    }

    result = result.replace(EMOJI_REGEX, '');

    // Collapse runs of multiple spaces left by stripped characters
    result = result.replace(/ {2,}/g, ' ');

    // Collapse runs of multiple newlines
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
  } catch {
    return text;
  }
}

/**
 * Check if every character in the text belongs to the GSM 03.38 character set.
 * Returns false if any character would force UCS-2 encoding.
 */
export function isGsm7Compatible(text: string): boolean {
  for (const char of text) {
    if (!GSM7_BASIC_CHARS.has(char)) {
      return false;
    }
  }
  return true;
}

/**
 * Count GSM-7 septets for a string, accounting for extension characters
 * that cost 2 septets each (escape + character).
 */
function countGsm7Septets(text: string): number {
  let count = 0;
  for (const char of text) {
    count += GSM7_EXTENSION_CHARS.has(char) ? 2 : 1;
  }
  return count;
}

export interface SegmentEstimate {
  encoding: 'gsm7' | 'ucs2';
  segments: number;
  characters: number;
}

/**
 * Estimate the number of SMS segments a message will consume.
 *
 * GSM-7: 160 chars single / 153 per part multi-segment
 * UCS-2: 70 chars single / 67 per part multi-segment
 *
 * Extension table characters (^, {, }, etc.) count as 2 GSM-7 septets.
 */
export function estimateSegments(text: string): SegmentEstimate {
  const characters = text.length;

  if (isGsm7Compatible(text)) {
    const septets = countGsm7Septets(text);
    const segments = septets <= 160 ? 1 : Math.ceil(septets / 153);
    return { encoding: 'gsm7', segments, characters };
  }

  const segments = characters <= 70 ? 1 : Math.ceil(characters / 67);
  return { encoding: 'ucs2', segments, characters };
}

/**
 * Truncate text to fit within a given number of SMS segments.
 * Appends "..." when truncation occurs.
 */
export function truncateToSegments(text: string, maxSegments: number): string {
  const current = estimateSegments(text);
  if (current.segments <= maxSegments) return text;

  const isGsm = isGsm7Compatible(text);
  const charsPerSegment = isGsm ? 153 : 67;
  const singleSegmentMax = isGsm ? 160 : 70;
  const ellipsis = '...';

  const maxChars = maxSegments === 1
    ? singleSegmentMax - ellipsis.length
    : (charsPerSegment * maxSegments) - ellipsis.length;

  const truncated = text.slice(0, Math.max(0, maxChars));
  // Cut at last word boundary for cleaner output
  const lastSpace = truncated.lastIndexOf(' ');
  const clean = lastSpace > maxChars * 0.6 ? truncated.slice(0, lastSpace) : truncated;

  return clean + ellipsis;
}

/**
 * Whether a channel type should have SMS encoding sanitization applied.
 * Extensibility point: add channel strings to the set for new SMS-like channels.
 */
export function shouldSanitizeSms(channelType: string | null): boolean {
  if (!channelType) return false;
  return SMS_CHANNELS.has(channelType.toUpperCase());
}
