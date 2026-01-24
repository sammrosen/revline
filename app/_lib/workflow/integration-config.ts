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
  LucideIcon,
  CalendarCheck,
  Send,
  FileText,
  Dumbbell,
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
  /** Lucide icon component */
  icon: LucideIcon;
}

export const INTEGRATION_CONFIG: Record<string, IntegrationStyle> = {
  calendly: {
    name: 'Calendly',
    color: '#006BFF',
    bgClass: 'bg-blue-500/20',
    borderClass: 'border-blue-500/40',
    textClass: 'text-blue-400',
    icon: Calendar,
  },
  stripe: {
    name: 'Stripe',
    color: '#635BFF',
    bgClass: 'bg-violet-500/20',
    borderClass: 'border-violet-500/40',
    textClass: 'text-violet-400',
    icon: CreditCard,
  },
  mailerlite: {
    name: 'MailerLite',
    color: '#09C269',
    bgClass: 'bg-emerald-500/20',
    borderClass: 'border-emerald-500/40',
    textClass: 'text-emerald-400',
    icon: Mail,
  },
  revline: {
    name: 'RevLine',
    color: '#F59E0B',
    bgClass: 'bg-amber-500/20',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-400',
    icon: Zap,
  },
  manychat: {
    name: 'ManyChat',
    color: '#FB3B64',
    bgClass: 'bg-pink-500/20',
    borderClass: 'border-pink-500/40',
    textClass: 'text-pink-400',
    icon: MessageCircle,
  },
  abc_ignite: {
    name: 'ABC Ignite',
    color: '#EF4444',
    bgClass: 'bg-red-500/20',
    borderClass: 'border-red-500/40',
    textClass: 'text-red-400',
    icon: Dumbbell,
  },
  resend: {
    name: 'Resend',
    color: '#000000',
    bgClass: 'bg-zinc-600/20',
    borderClass: 'border-zinc-500/40',
    textClass: 'text-zinc-300',
    icon: Send,
  },
  capture: {
    name: 'Form Capture',
    color: '#8B5CF6',
    bgClass: 'bg-purple-500/20',
    borderClass: 'border-purple-500/40',
    textClass: 'text-purple-400',
    icon: FileText,
  },
  booking: {
    name: 'Booking System',
    color: '#10B981',
    bgClass: 'bg-emerald-500/20',
    borderClass: 'border-emerald-500/40',
    textClass: 'text-emerald-400',
    icon: CalendarCheck,
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
    }
  );
}

/**
 * Operation display names
 */
export const OPERATION_LABELS: Record<string, string> = {
  // Triggers - Calendly
  booking_created: 'Booking Created',
  booking_canceled: 'Booking Canceled',
  // Triggers - Stripe
  payment_succeeded: 'Payment Succeeded',
  subscription_created: 'Subscription Created',
  subscription_canceled: 'Subscription Canceled',
  // Triggers - RevLine
  email_captured: 'Email Captured',
  // Triggers - ManyChat
  dm_received: 'DM Received',
  // Triggers - Booking System (sync)
  create_booking: 'Create Booking',
  add_to_waitlist: 'Add to Waitlist',
  // Triggers - Capture
  booking_confirmed: 'Booking Confirmed',
  booking_waitlisted: 'Booking Waitlisted',
  form_captured: 'Form Captured',
  // Actions - MailerLite
  add_to_group: 'Add to Group',
  remove_from_group: 'Remove from Group',
  add_tag: 'Add Tag',
  // Actions - RevLine
  create_lead: 'Create Lead',
  update_lead_stage: 'Update Lead Stage',
  emit_event: 'Emit Event',
  // Actions - ManyChat
  trigger_flow: 'Trigger Flow',
  // Actions - ABC Ignite
  lookup_member: 'Lookup Member',
  check_availability: 'Check Availability',
  create_appointment: 'Create Appointment',
  enroll_member: 'Enroll Member',
  unenroll_member: 'Unenroll Member',
  // Actions - Resend
  send_email: 'Send Email',
};

/**
 * Get operation display label
 */
export function getOperationLabel(operation: string): string {
  return OPERATION_LABELS[operation] ?? operation.replace(/_/g, ' ');
}

