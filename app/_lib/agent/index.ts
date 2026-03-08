/**
 * Agent Engine
 *
 * Import from '@/app/_lib/agent'
 *
 * @example
 * import { handleInboundMessage } from '@/app/_lib/agent';
 *
 * const result = await handleInboundMessage({
 *   workspaceId: '...',
 *   agentId: '...',
 *   contactAddress: '+15551234567',
 *   channelAddress: '+15559876543',
 *   channel: 'SMS',
 *   messageText: 'Hello!',
 * });
 */

export { handleInboundMessage, initiateConversation } from './engine';
export type {
  InboundMessageParams,
  InitiateConversationParams,
  AgentResponse,
  AgentConfig,
  ConversationWithMessages,
  ConversationStatus,
  MessageRole,
} from './types';
