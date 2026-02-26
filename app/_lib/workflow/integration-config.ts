/**
 * Integration Configuration
 *
 * Defines visual styling (colors, icons) for each adapter.
 * Used by workflow visualization components.
 */

import {
  Calendar,
  CreditCard,
  Mail,
  Zap,
  MessageCircle,
  Sparkles,
  Bot,
  LucideIcon,
} from 'lucide-react';

export interface IntegrationStyle {
  /** Display name */
  name: string;
  /** Brand color hex */
  color: string;
  /** Tailwind background class */
  bgClass: string;
  /** Tailwind border class */
  borderClass: string;
  /** Tailwind text class */
  textClass: string;
  /** Lucide icon component (fallback) */
  icon: LucideIcon;
  /** Logo image path in /public/logos/ */
  logo: string;
}

export const INTEGRATION_CONFIG: Record<string, IntegrationStyle> = {
  calendly: {
    name: 'Calendly',
    color: '#0069fe',
    bgClass: 'bg-blue-500/20',
    borderClass: 'border-blue-500/40',
    textClass: 'text-blue-400',
    icon: Calendar,
    logo: '/logos/calendly.png',
  },
  stripe: {
    name: 'Stripe',
    color: '#5539fd',
    bgClass: 'bg-violet-500/20',
    borderClass: 'border-violet-500/40',
    textClass: 'text-violet-400',
    icon: CreditCard,
    logo: '/logos/stripe.png',
  },
  mailerlite: {
    name: 'MailerLite',
    color: '#19b575',
    bgClass: 'bg-emerald-500/20',
    borderClass: 'border-emerald-500/40',
    textClass: 'text-emerald-400',
    icon: Mail,
    logo: '/logos/mailerlite.png',
  },
  revline: {
    name: 'RevLine',
    color: '#ff6100',
    bgClass: 'bg-orange-500/20',
    borderClass: 'border-orange-500/40',
    textClass: 'text-orange-400',
    icon: Zap,
    logo: '/logos/RevLine.png',
  },
  manychat: {
    name: 'ManyChat',
    color: '#000000',
    bgClass: 'bg-zinc-500/20',
    borderClass: 'border-zinc-500/40',
    textClass: 'text-zinc-300',
    icon: MessageCircle,
    logo: '/logos/manychat.png',
  },
  abc_ignite: {
    name: 'ABC Ignite',
    color: '#214377',
    bgClass: 'bg-blue-900/20',
    borderClass: 'border-blue-900/40',
    textClass: 'text-blue-300',
    icon: Zap,
    logo: '/logos/abc-ignite.png',
  },
  resend: {
    name: 'Resend',
    color: '#000000',
    bgClass: 'bg-zinc-500/20',
    borderClass: 'border-zinc-500/40',
    textClass: 'text-zinc-300',
    icon: Mail,
    logo: '/logos/resend.png',
  },
  twilio: {
    name: 'Twilio',
    color: '#F22F46',
    bgClass: 'bg-red-500/20',
    borderClass: 'border-red-500/40',
    textClass: 'text-red-400',
    icon: MessageCircle,
    logo: '/logos/twilio.png',
  },
  openai: {
    name: 'OpenAI',
    color: '#000000',
    bgClass: 'bg-zinc-500/20',
    borderClass: 'border-zinc-500/40',
    textClass: 'text-zinc-300',
    icon: Sparkles,
    logo: '/logos/openai.png',
  },
  anthropic: {
    name: 'Anthropic',
    color: '#D4A574',
    bgClass: 'bg-amber-500/20',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-300',
    icon: Sparkles,
    logo: '/logos/anthropic.png',
  },
  chatbot: {
    name: 'Chatbot',
    color: '#8B5CF6',
    bgClass: 'bg-violet-500/20',
    borderClass: 'border-violet-500/40',
    textClass: 'text-violet-400',
    icon: Bot,
    logo: '/logos/chatbot.png',
  },
  capture: {
    name: 'Capture',
    color: '#71717A',
    bgClass: 'bg-zinc-500/20',
    borderClass: 'border-zinc-500/40',
    textClass: 'text-zinc-400',
    icon: Zap,
    logo: '/logos/capture.png',
  },
};

/**
 * Get integration style by adapter ID
 * Returns a default style if adapter is not found
 */
export function getIntegrationStyle(adapterId: string): IntegrationStyle {
  return (
    INTEGRATION_CONFIG[adapterId] ?? {
      name: adapterId,
      color: '#71717A',
      bgClass: 'bg-zinc-500/20',
      borderClass: 'border-zinc-500/40',
      textClass: 'text-zinc-400',
      icon: Zap,
      logo: '', // No logo for unknown integrations
    }
  );
}

/**
 * Operation display names
 */
export const OPERATION_LABELS: Record<string, string> = {
  // Triggers
  booking_created: 'Booking Created',
  booking_canceled: 'Booking Canceled',
  payment_succeeded: 'Payment Succeeded',
  subscription_created: 'Subscription Created',
  subscription_canceled: 'Subscription Canceled',
  email_captured: 'Email Captured',
  dm_received: 'DM Received',
  // Chatbot triggers
  conversation_started: 'Conversation Started',
  escalation_requested: 'Escalation Requested',
  conversation_completed: 'Conversation Completed',
  bot_event: 'Bot Event',
  // Actions
  add_to_group: 'Add to Group',
  remove_from_group: 'Remove from Group',
  add_tag: 'Add Tag',
  create_lead: 'Create Lead',
  update_lead_stage: 'Update Lead Stage',
  emit_event: 'Emit Event',
  trigger_flow: 'Trigger Flow',
  route_to_chatbot: 'Route to Chatbot',
};

/**
 * Get operation display label
 */
export function getOperationLabel(operation: string): string {
  return OPERATION_LABELS[operation] ?? operation.replace(/_/g, ' ');
}

