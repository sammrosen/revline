/**
 * Agent Adapter Registry Tests
 *
 * Priority: P1 - High
 * If broken: Engine can't resolve AI or channel adapters
 *
 * Tests resolveAI(), resolveChannel(), and related lookups.
 * These tests import the real registry (not mocked) to verify
 * the static registry entries are correct.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveAI,
  resolveChannel,
  getContactFieldForChannel,
  getRegisteredAIProviders,
  getRegisteredChannelProviders,
  getDefaultModelForProvider,
} from '@/app/_lib/agent/adapter-registry';

describe('Agent Adapter Registry — AI', () => {
  it('resolves OPENAI with correct default model', () => {
    const entry = resolveAI('OPENAI');
    expect(entry).not.toBeNull();
    expect(entry!.label).toBe('OpenAI');
    expect(entry!.defaultModel).toBe('gpt-4.1-mini');
    expect(typeof entry!.forWorkspace).toBe('function');
  });

  it('resolves ANTHROPIC with correct default model', () => {
    const entry = resolveAI('ANTHROPIC');
    expect(entry).not.toBeNull();
    expect(entry!.label).toBe('Anthropic');
    expect(entry!.defaultModel).toBe('claude-sonnet-4-6');
  });

  it('is case-insensitive', () => {
    expect(resolveAI('openai')).not.toBeNull();
    expect(resolveAI('Openai')).not.toBeNull();
    expect(resolveAI('anthropic')).not.toBeNull();
  });

  it('returns null for unknown AI provider', () => {
    expect(resolveAI('unknown')).toBeNull();
    expect(resolveAI('')).toBeNull();
  });

  it('getRegisteredAIProviders returns both providers', () => {
    const providers = getRegisteredAIProviders();
    expect(providers).toContain('OPENAI');
    expect(providers).toContain('ANTHROPIC');
    expect(providers.length).toBe(2);
  });

  it('getDefaultModelForProvider returns correct models', () => {
    expect(getDefaultModelForProvider('OPENAI')).toBe('gpt-4.1-mini');
    expect(getDefaultModelForProvider('ANTHROPIC')).toBe('claude-sonnet-4-6');
    expect(getDefaultModelForProvider('UNKNOWN')).toBe('unknown');
  });
});

describe('Agent Adapter Registry — Channel', () => {
  it('resolves TWILIO with correct contactField', () => {
    const entry = resolveChannel('TWILIO');
    expect(entry).not.toBeNull();
    expect(entry!.label).toBe('Twilio');
    expect(entry!.contactField).toBe('phone');
    expect(typeof entry!.forWorkspace).toBe('function');
  });

  it('is case-insensitive', () => {
    expect(resolveChannel('twilio')).not.toBeNull();
    expect(resolveChannel('Twilio')).not.toBeNull();
  });

  it('returns null for unknown channel provider', () => {
    expect(resolveChannel('unknown')).toBeNull();
    expect(resolveChannel('')).toBeNull();
  });

  it('getContactFieldForChannel returns correct field', () => {
    expect(getContactFieldForChannel('TWILIO')).toBe('phone');
    expect(getContactFieldForChannel('unknown')).toBeNull();
  });

  it('getRegisteredChannelProviders returns Twilio', () => {
    const providers = getRegisteredChannelProviders();
    expect(providers).toContain('TWILIO');
    expect(providers.length).toBe(1);
  });
});
