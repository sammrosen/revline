/**
 * AI Model Pricing
 *
 * Static pricing map for cost estimation. Prices are per 1M tokens.
 * Updated manually — check provider pricing pages when adding models.
 */

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4.1': { inputPerMillion: 2.0, outputPerMillion: 8.0 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  'gpt-4.1-nano': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },

  // Anthropic
  'claude-opus-4-6': { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  'claude-sonnet-4-6': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-haiku-4-5-20251001': { inputPerMillion: 0.8, outputPerMillion: 4.0 },
};

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
  isEstimated: boolean;
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): CostEstimate {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    return {
      inputCost: 0,
      outputCost: 0,
      totalCost: 0,
      model,
      isEstimated: false,
    };
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerMillion;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    model,
    isEstimated: true,
  };
}

export function getKnownModels(): string[] {
  return Object.keys(MODEL_PRICING);
}

export function getDefaultModel(aiIntegration: string): string {
  switch (aiIntegration.toUpperCase()) {
    case 'OPENAI':
      return 'gpt-4.1-mini';
    case 'ANTHROPIC':
      return 'claude-sonnet-4-6';
    default:
      return 'unknown';
  }
}
