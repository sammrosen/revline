/**
 * Agent Pricing Tests
 *
 * Priority: P2 - Medium
 * If broken: Cost estimates in the test chat panel are wrong
 *
 * Tests estimateCost() and getKnownModels() from pricing.ts
 */

import { describe, it, expect } from 'vitest';
import { estimateCost, getKnownModels } from '@/app/_lib/agent/pricing';

describe('Agent Pricing — estimateCost', () => {
  it('calculates correct cost for gpt-4.1-mini', () => {
    // gpt-4.1-mini: $0.40/1M input, $1.60/1M output
    const result = estimateCost('gpt-4.1-mini', 1_000_000, 500_000);

    expect(result.isEstimated).toBe(true);
    expect(result.model).toBe('gpt-4.1-mini');
    expect(result.inputCost).toBeCloseTo(0.4);
    expect(result.outputCost).toBeCloseTo(0.8);
    expect(result.totalCost).toBeCloseTo(1.2);
  });

  it('calculates correct cost for claude-sonnet-4-6', () => {
    // claude-sonnet-4-6: $3.00/1M input, $15.00/1M output
    const result = estimateCost('claude-sonnet-4-6', 100_000, 50_000);

    expect(result.isEstimated).toBe(true);
    expect(result.inputCost).toBeCloseTo(0.3);
    expect(result.outputCost).toBeCloseTo(0.75);
    expect(result.totalCost).toBeCloseTo(1.05);
  });

  it('calculates correct cost for gpt-4o', () => {
    // gpt-4o: $2.50/1M input, $10.00/1M output
    const result = estimateCost('gpt-4o', 200_000, 100_000);

    expect(result.isEstimated).toBe(true);
    expect(result.inputCost).toBeCloseTo(0.5);
    expect(result.outputCost).toBeCloseTo(1.0);
    expect(result.totalCost).toBeCloseTo(1.5);
  });

  it('returns zero cost with isEstimated=false for unknown model', () => {
    const result = estimateCost('unknown-model-v99', 1000, 500);

    expect(result.isEstimated).toBe(false);
    expect(result.model).toBe('unknown-model-v99');
    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it('returns zero cost when tokens are zero', () => {
    const result = estimateCost('gpt-4.1-mini', 0, 0);

    expect(result.isEstimated).toBe(true);
    expect(result.totalCost).toBe(0);
  });
});

describe('Agent Pricing — getKnownModels', () => {
  it('returns all expected OpenAI models', () => {
    const models = getKnownModels();
    expect(models).toContain('gpt-4.1');
    expect(models).toContain('gpt-4.1-mini');
    expect(models).toContain('gpt-4.1-nano');
    expect(models).toContain('gpt-4o');
    expect(models).toContain('gpt-4o-mini');
  });

  it('returns all expected Anthropic models', () => {
    const models = getKnownModels();
    expect(models).toContain('claude-opus-4-6');
    expect(models).toContain('claude-sonnet-4-6');
    expect(models).toContain('claude-haiku-4-5-20251001');
  });

  it('returns a non-empty array', () => {
    const models = getKnownModels();
    expect(models.length).toBeGreaterThan(0);
  });
});
