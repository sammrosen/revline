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

export { handleInboundMessage, initiateConversation, loadAgent, sendReply, callAI } from './engine';
export { getAvailableTools } from './tool-registry';
export type {
  InboundMessageParams,
  InitiateConversationParams,
  AgentResponse,
  AgentConfig,
  ConversationWithMessages,
  ConversationStatus,
  MessageRole,
  TurnLogEntry,
  RetryLog,
} from './types';
export type { SendType, SendReplyResult } from './quiet-hours';
export { checkSendWindow, shouldEnforceQuietHours } from './quiet-hours';
export type { SegmentEstimate } from './sms-encoding';
export { sanitizeForGsm7, isGsm7Compatible, estimateSegments, shouldSanitizeSms } from './sms-encoding';
export type { RetryOptions } from './retry';
export { retryWithBackoff } from './retry';
export type { FollowUpRecord, ProcessResult } from './follow-up';
export { scheduleFollowUp, cancelPendingFollowUps, processFollowUp, generateFollowUpMessage } from './follow-up';
