/**
 * Chatbot Engine
 *
 * Import from '@/app/_lib/chatbot'
 *
 * @example
 * import { handleInboundMessage } from '@/app/_lib/chatbot';
 *
 * const result = await handleInboundMessage({
 *   workspaceId: '...',
 *   chatbotId: '...',
 *   contactAddress: '+15551234567',
 *   channelAddress: '+15559876543',
 *   channel: 'SMS',
 *   messageText: 'Hello!',
 * });
 */

export { handleInboundMessage } from './engine';
export type {
  InboundMessageParams,
  ChatbotResponse,
  ChatbotConfig,
  ConversationWithMessages,
  ConversationStatus,
  MessageRole,
} from './types';
