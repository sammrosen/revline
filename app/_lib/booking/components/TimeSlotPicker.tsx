'use client';

/**
 * TimeSlotPicker Component
 * 
 * Displays available time slots and allows selection.
 * Supports date filtering and shows slot details.
 */

import { useState, useEffect, useCallback } from 'react';
import { TimeSlot } from '../types';
import { BookingApi } from '@/app/_lib/api-paths';

interface TimeSlotPickerProps {
  clientSlug: string;
  eventTypeId?: string;
  slots: TimeSlot[];
  setSlots: (slots: TimeSlot[]) => void;
  onSlotSelected: (slot: TimeSlot) => void;
  onError: (error: string) => void;
  onBack?: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export function TimeSlotPicker({
  clientSlug,
  eventTypeId,
  slots,
  setSlots,
  onSlotSelected,
  onError,
  onBack,
  loading,
  setLoading,
}: TimeSlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [fetched, setFetched] = useState(false);

  // Get date range (selected date + 6 more days)
  const getDateRange = useCallback(() => {
    const start = new Date(selectedDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, [selectedDate]);

  // Fetch availability
  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setFetched(true);

    try {
      const { startDate, endDate } = getDateRange();
      const params = new URLSearchParams({
        clientSlug,
        startDate,
        endDate,
        ...(eventTypeId && { eventTypeId }),
      });

      const response = await fetch(`${BookingApi.availability}?${params}`);
      const data = await response.json();

      if (!response.ok) {
        onError(data.error || 'Failed to load availability');
        return;
      }

      setSlots(data.data.slots);
    } catch {
      onError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [clientSlug, eventTypeId, getDateRange, onError, setLoading, setSlots]);

  // Fetch on mount and when date changes
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Group slots by date
  const slotsByDate = groupSlotsByDate(slots);
  const dates = Object.keys(slotsByDate).sort();

  // Date navigation
  const goToPreviousWeek = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 7);
    setSelectedDate(date.toISOString().split('T')[0]);
    setFetched(false);
  };

  const goToNextWeek = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 7);
    setSelectedDate(date.toISOString().split('T')[0]);
    setFetched(false);
  };

  const canGoPrevious = new Date(selectedDate) > new Date();

  return (
    <div>
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">Book Your Session</h2>
        <p className="text-zinc-400">Browse available times and pick one that works for you</p>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between mb-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
        <button
          onClick={goToPreviousWeek}
          disabled={!canGoPrevious || loading}
          className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="text-center">
          <p className="text-sm text-zinc-500">Showing availability for</p>
          <p className="text-white font-medium">
            {formatDateRange(selectedDate)}
          </p>
        </div>
        
        <button
          onClick={goToNextWeek}
          disabled={loading}
          className="p-2 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12">
          <svg className="animate-spin h-8 w-8 text-amber-400 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-zinc-400">Loading available times...</p>
        </div>
      )}

      {/* No slots */}
      {!loading && fetched && slots.length === 0 && (
        <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <svg className="w-12 h-12 text-zinc-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-zinc-400 mb-2">No available times for this week</p>
          <p className="text-sm text-zinc-500">Try selecting a different week</p>
        </div>
      )}

      {/* Slots list */}
      {!loading && slots.length > 0 && (
        <div className="space-y-6">
          {dates.map(date => (
            <div key={date}>
              <h3 className="text-sm font-medium text-zinc-400 mb-3">
                {formatDate(date)}
              </h3>
              <div className="grid gap-2">
                {slotsByDate[date].map(slot => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onSelect={() => onSlotSelected(slot)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Back button */}
      {onBack && (
        <div className="mt-8">
          <button
            onClick={onBack}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            ← Go back
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Individual slot card
 */
function SlotCard({ slot, onSelect }: { slot: TimeSlot; onSelect: () => void }) {
  const isFull = slot.spotsAvailable === 0;
  const startTime = new Date(slot.startTime);
  
  return (
    <button
      onClick={onSelect}
      disabled={isFull}
      className={`
        w-full p-4 text-left rounded-lg border transition-all
        ${isFull 
          ? 'bg-zinc-900/50 border-zinc-800 opacity-50 cursor-not-allowed' 
          : 'bg-zinc-900 border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800'
        }
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-white">
            {startTime.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            })}
          </p>
          <p className="text-sm text-zinc-400">{slot.title}</p>
          {slot.staffName && (
            <p className="text-xs text-zinc-500 mt-1">with {slot.staffName}</p>
          )}
        </div>
        
        <div className="text-right">
          {slot.spotsAvailable !== undefined && (
            <p className={`text-sm ${isFull ? 'text-red-400' : 'text-zinc-400'}`}>
              {isFull ? 'Full' : `${slot.spotsAvailable} spots`}
            </p>
          )}
          {slot.duration && (
            <p className="text-xs text-zinc-500">{slot.duration} min</p>
          )}
        </div>
      </div>
    </button>
  );
}

/**
 * Group slots by date
 */
function groupSlotsByDate(slots: TimeSlot[]): Record<string, TimeSlot[]> {
  const grouped: Record<string, TimeSlot[]> = {};
  
  for (const slot of slots) {
    const date = slot.startTime.split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(slot);
  }
  
  // Sort slots within each date by time
  for (const date of Object.keys(grouped)) {
    grouped[date].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  }
  
  return grouped;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.getTime() === today.getTime()) {
    return 'Today';
  }
  if (date.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Format date range for header
 */
function formatDateRange(startDate: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
  }
  
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}
