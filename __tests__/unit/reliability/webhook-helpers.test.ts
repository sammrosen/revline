/**
 * Webhook Helper Function Tests
 * 
 * Priority: P1 - High
 * If broken: Wrong event IDs extracted, duplicate detection fails
 * 
 * Tests:
 * - extractProviderEventId for different providers
 * - shouldSkipDuplicate for different statuses
 */

import { describe, it, expect } from 'vitest';
import {
  extractProviderEventId,
  shouldSkipDuplicate,
} from '@/app/_lib/reliability';

describe('Webhook Helper Functions', () => {
  describe('extractProviderEventId', () => {
    describe('Stripe provider', () => {
      it('should extract id field from Stripe event', () => {
        const rawBody = JSON.stringify({
          id: 'evt_1234567890',
          type: 'checkout.session.completed',
          data: { object: {} },
        });

        const eventId = extractProviderEventId('stripe', rawBody);

        expect(eventId).toBe('evt_1234567890');
      });

      it('should return null for Stripe event without id', () => {
        const rawBody = JSON.stringify({
          type: 'checkout.session.completed',
          data: { object: {} },
        });

        const eventId = extractProviderEventId('stripe', rawBody);

        expect(eventId).toBeNull();
      });
    });

    describe('Calendly provider', () => {
      it('should extract event URI from Calendly payload', () => {
        const rawBody = JSON.stringify({
          event: 'invitee.created',
          payload: {
            event: 'https://calendly.com/events/abc123',
            email: 'user@example.com',
          },
        });

        const eventId = extractProviderEventId('calendly', rawBody);

        expect(eventId).toBe('https://calendly.com/events/abc123');
      });

      it('should fallback to uri field for Calendly', () => {
        const rawBody = JSON.stringify({
          event: 'invitee.created',
          payload: {
            uri: 'https://calendly.com/invitees/xyz789',
            email: 'user@example.com',
          },
        });

        const eventId = extractProviderEventId('calendly', rawBody);

        expect(eventId).toBe('https://calendly.com/invitees/xyz789');
      });

      it('should return null for Calendly event without event/uri', () => {
        const rawBody = JSON.stringify({
          event: 'invitee.created',
          payload: {
            email: 'user@example.com',
          },
        });

        const eventId = extractProviderEventId('calendly', rawBody);

        expect(eventId).toBeNull();
      });
    });

    describe('RevLine (internal) provider', () => {
      it('should generate ID based on email for revline events', () => {
        const rawBody = JSON.stringify({
          email: 'user@example.com',
          name: 'Test User',
          source: 'landing',
        });

        const eventId = extractProviderEventId('revline', rawBody);

        expect(eventId).toMatch(/^user@example\.com-\d+$/);
      });

      it('should generate random ID for revline event without email', () => {
        const rawBody = JSON.stringify({
          name: 'Test User',
          source: 'landing',
        });

        const eventId = extractProviderEventId('revline', rawBody);

        expect(eventId).toMatch(/^internal-\d+-[a-z0-9]+$/);
      });

      it('should generate unique IDs for multiple calls', () => {
        const rawBody = JSON.stringify({
          name: 'Test User',
        });

        const eventId1 = extractProviderEventId('revline', rawBody);
        const eventId2 = extractProviderEventId('revline', rawBody);

        expect(eventId1).not.toBe(eventId2);
      });
    });

    describe('error handling', () => {
      it('should return null for invalid JSON', () => {
        const rawBody = 'not valid json {{{';

        const eventId = extractProviderEventId('stripe', rawBody);

        expect(eventId).toBeNull();
      });

      it('should return null for empty body', () => {
        const eventId = extractProviderEventId('stripe', '');

        expect(eventId).toBeNull();
      });
    });
  });

  describe('shouldSkipDuplicate', () => {
    describe('PROCESSED status', () => {
      it('should skip (return true) for PROCESSED status', () => {
        const result = shouldSkipDuplicate('PROCESSED', new Date());

        expect(result).toBe(true);
      });

      it('should skip PROCESSED regardless of time', () => {
        const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        const result = shouldSkipDuplicate('PROCESSED', oldDate);

        expect(result).toBe(true);
      });
    });

    describe('PROCESSING status', () => {
      it('should skip (return true) for PROCESSING status', () => {
        const result = shouldSkipDuplicate('PROCESSING', new Date());

        expect(result).toBe(true);
      });

      it('should skip PROCESSING regardless of time', () => {
        const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = shouldSkipDuplicate('PROCESSING', oldDate);

        expect(result).toBe(true);
      });
    });

    describe('PENDING status', () => {
      it('should NOT skip (return false) for PENDING status', () => {
        const result = shouldSkipDuplicate('PENDING', new Date());

        expect(result).toBe(false);
      });

      it('should NOT skip PENDING regardless of time', () => {
        const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = shouldSkipDuplicate('PENDING', oldDate);

        expect(result).toBe(false);
      });
    });

    describe('FAILED status', () => {
      it('should skip (return true) for recent FAILED events (within 5 minutes)', () => {
        const recentDate = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
        const result = shouldSkipDuplicate('FAILED', recentDate);

        expect(result).toBe(true);
      });

      it('should NOT skip (return false) for old FAILED events (over 5 minutes)', () => {
        const oldDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
        const result = shouldSkipDuplicate('FAILED', oldDate);

        expect(result).toBe(false);
      });

      it('should NOT skip FAILED events exactly at 5 minute boundary', () => {
        const exactlyFiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const result = shouldSkipDuplicate('FAILED', exactlyFiveMinutesAgo);

        expect(result).toBe(false);
      });
    });
  });
});
