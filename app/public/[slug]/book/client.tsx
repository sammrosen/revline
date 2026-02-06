'use client';

/**
 * Public Magic Link Booking Client
 * 
 * Simplified booking flow with magic link confirmation:
 * 1. Select time slot
 * 2. Enter barcode + email
 * 3. Submit → "Check your email" message
 * 
 * Security:
 * - No enumeration (same response for all outcomes)
 * - Server-side verification only
 * - Email confirmation required
 * 
 * Configuration:
 * - Branding (colors, logo) from workspace config
 * - Copy (headlines, button text) from workspace config
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  BookingProviderCapabilities,
  BookingEmployee,
  TimeSlot,
} from '@/app/_lib/booking';
import type { ResolvedBranding, ResolvedBookingCopy, ResolvedFeatures } from '@/app/_lib/config';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Derived brand colors computed from primary color
 */
interface DerivedBrand {
  primary: string;
  primaryHover: string;
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
}

// Steps in the simplified flow
type MagicLinkStep = 'select' | 'submit' | 'pending';

interface MagicLinkBookingState {
  step: MagicLinkStep;
  selectedSlot: TimeSlot | null;
  selectedEmployee: BookingEmployee | null;
  employees: BookingEmployee[];
  slots: TimeSlot[];
  loading: boolean;
  error: string | null;
  // Date selection
  selectedDate: string;
  // Form fields for submit step
  barcode: string;
  email: string;
  phone: string;
}

interface MagicLinkBookingClientProps {
  workspaceSlug: string;
  workspaceName: string;
  capabilities: BookingProviderCapabilities;
  initialBarcode?: string | null;
  /** Branding configuration from workspace */
  branding: ResolvedBranding;
  /** Copy configuration for booking template */
  copy: ResolvedBookingCopy;
  /** Feature flags */
  features: ResolvedFeatures;
  /** Preview mode - uses mock data, no API calls */
  previewMode?: boolean;
}

// =============================================================================
// MOCK DATA FOR PREVIEW MODE
// =============================================================================

const MOCK_EMPLOYEES: BookingEmployee[] = [
  { key: 'trainer-1', name: 'Alex Martinez', title: 'Personal Trainer' },
  { key: 'trainer-2', name: 'Jordan Taylor', title: 'Fitness Coach' },
  { key: 'trainer-3', name: 'Sam Kim', title: 'Strength Specialist' },
];

function generateMockSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const today = new Date();
  
  // Generate slots for next 7 days
  for (let day = 0; day < 7; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() + day);
    
    // Skip weekends for realism
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // Morning and afternoon slots
    for (const hour of [9, 10, 11, 14, 15, 16]) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, 0, 0, 0);
      
      slots.push({
        id: `slot-${day}-${hour}`,
        startTime: slotDate.toISOString(),
        endTime: new Date(slotDate.getTime() + 60 * 60 * 1000).toISOString(),
        duration: 60,
        title: 'Personal Training Session',
        staffName: MOCK_EMPLOYEES[0].name,
      });
    }
  }
  
  return slots;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Derive full brand colors from primary color
 * Ensures consistent theming with configurable primary
 */
function deriveBrandColors(branding: ResolvedBranding): DerivedBrand {
  return {
    primary: branding.primaryColor,
    primaryHover: branding.secondaryColor,
    background: branding.backgroundColor,
    card: '#ffffff',
    text: '#111827',
    textMuted: '#6b7280',
    border: '#e5e7eb',
    success: '#059669',
  };
}

const getInitialDate = () => new Date().toISOString().split('T')[0];

const initialState: MagicLinkBookingState = {
  step: 'select',
  selectedSlot: null,
  selectedEmployee: null,
  employees: [],
  slots: [],
  loading: false,
  error: null,
  selectedDate: getInitialDate(),
  barcode: '',
  email: '',
  phone: '',
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function MagicLinkBookingClient({
  workspaceSlug,
  workspaceName,
  capabilities,
  initialBarcode,
  branding,
  copy,
  features,
  previewMode = false,
}: MagicLinkBookingClientProps) {
  // Generate mock data once for preview mode
  const mockSlots = useMemo(() => previewMode ? generateMockSlots() : [], [previewMode]);
  
  const [state, setState] = useState<MagicLinkBookingState>(() => ({
    ...initialState,
    barcode: initialBarcode || '',
    // In preview mode, initialize with mock data
    ...(previewMode ? {
      employees: MOCK_EMPLOYEES,
      selectedEmployee: MOCK_EMPLOYEES[0],
      slots: mockSlots,
    } : {}),
  }));

  // Derive brand colors from config
  const brand = useMemo(() => deriveBrandColors(branding), [branding]);

  // Load employees on mount (skip in preview mode)
  useEffect(() => {
    if (previewMode) return; // Skip API calls in preview mode
    
    if (capabilities.supportsEmployeeSelection) {
      loadEmployees();
    } else {
      loadAvailability();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode]);

  const loadEmployees = async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const response = await fetch(`/api/v1/booking/employees?workspaceSlug=${workspaceSlug}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load trainers');
      }
      
      setState(s => ({
        ...s,
        employees: data.data?.employees || [],
        selectedEmployee: data.data?.employees?.[0] || null,
        loading: false,
      }));
      
      // Load availability for first employee
      if (data.data?.employees?.[0]) {
        loadAvailability(data.data.employees[0].key);
      }
    } catch (error) {
      setState(s => ({
        ...s,
        error: error instanceof Error ? error.message : 'Failed to load trainers',
        loading: false,
      }));
    }
  };

  const loadAvailability = async (employeeKey?: string, dateOverride?: string) => {
    setState(s => ({ ...s, loading: true }));
    
    const startDate = dateOverride || state.selectedDate;
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6); // Fetch 7 days
    const endDate = end.toISOString().split('T')[0];
    
    try {
      const params = new URLSearchParams({
        workspaceSlug,
        startDate,
        endDate,
      });
      
      if (employeeKey) {
        params.set('staffId', employeeKey);
      }
      
      const response = await fetch(`/api/v1/booking/availability?${params}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load availability');
      }
      
      setState(s => ({
        ...s,
        slots: data.data?.slots || [],
        loading: false,
      }));
    } catch (error) {
      setState(s => ({
        ...s,
        error: error instanceof Error ? error.message : 'Failed to load availability',
        loading: false,
      }));
    }
  };

  const handleEmployeeSelect = useCallback((employee: BookingEmployee) => {
    setState(s => ({ ...s, selectedEmployee: employee, selectedSlot: null }));
    if (!previewMode) {
      loadAvailability(employee.key, state.selectedDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedDate, previewMode]);

  const handleDateChange = useCallback((newDate: string) => {
    setState(s => ({ ...s, selectedDate: newDate, slots: previewMode ? mockSlots : [] }));
    if (!previewMode) {
      loadAvailability(state.selectedEmployee?.key, newDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedEmployee?.key, previewMode, mockSlots]);

  const handleSlotSelect = useCallback((slot: TimeSlot) => {
    setState(s => ({ ...s, selectedSlot: slot, step: 'submit', error: null }));
  }, []);

  const handleSubmit = async () => {
    // In preview mode, just show the pending step without making API call
    if (previewMode) {
      setState(s => ({ ...s, step: 'pending' }));
      return;
    }
    
    const { barcode, email, phone, selectedSlot, selectedEmployee } = state;
    
    // Validate inputs
    if (!barcode.trim()) {
      setState(s => ({ ...s, error: 'Please enter your member barcode' }));
      return;
    }
    
    if (!email.trim() || !email.includes('@')) {
      setState(s => ({ ...s, error: 'Please enter a valid email address' }));
      return;
    }
    
    if (!phone.trim() || phone.replace(/\D/g, '').length < 4) {
      setState(s => ({ ...s, error: 'Please enter the last 4 digits of your phone number' }));
      return;
    }
    
    if (!selectedSlot) {
      setState(s => ({ ...s, error: 'Please select a time slot' }));
      return;
    }
    
    setState(s => ({ ...s, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/v1/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug,
          identifier: barcode.trim(),
          staffId: selectedEmployee?.key || selectedSlot.providerData?.employeeId || '',
          slotTime: selectedSlot.startTime,
          email: email.trim(),
          serviceId: selectedSlot.providerData?.eventTypeId,
          serviceName: selectedSlot.title,
          staffName: selectedEmployee?.name || selectedSlot.staffName,
          // Pass full provider data - used to build exact API payload at request time
          slotProviderData: selectedSlot.providerData,
        }),
      });
      
      // We always get a success response (by design)
      await response.json();
      
      // Move to pending step regardless of actual outcome
      setState(s => ({ ...s, step: 'pending', loading: false }));
      
    } catch {
      // Even on network error, show the pending message
      // This prevents attackers from distinguishing between success/failure
      setState(s => ({ ...s, step: 'pending', loading: false }));
    }
  };

  const handleBack = useCallback(() => {
    setState(s => ({ ...s, step: 'select', error: null }));
  }, []);

  const handleReset = useCallback(() => {
    setState({
      ...initialState,
      barcode: initialBarcode || '',
      // In preview mode, keep mock data
      ...(previewMode ? {
        employees: MOCK_EMPLOYEES,
        selectedEmployee: MOCK_EMPLOYEES[0],
        slots: mockSlots,
      } : {}),
    });
    if (!previewMode) {
      if (capabilities.supportsEmployeeSelection) {
        loadEmployees();
      } else {
        loadAvailability();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBarcode, capabilities.supportsEmployeeSelection, previewMode, mockSlots]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: brand.background }}>
      {/* Header */}
      <header className="bg-zinc-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {branding.logo ? (
              <img 
                src={branding.logo} 
                alt={workspaceName} 
                className="h-8 object-contain"
              />
            ) : (
              <div className="bg-white px-3 py-2 rounded">
                <span className="font-bold text-zinc-800 text-sm">{workspaceName.toUpperCase()}</span>
              </div>
            )}
          </div>
          <span className="text-sm text-zinc-400">{copy.headline}</span>
        </div>
        
        {/* Step indicator */}
        {state.step !== 'pending' && (
          <div className="bg-zinc-700">
            <div className="max-w-4xl mx-auto px-4">
              <div className="flex">
                {(['select', 'submit'] as const).map((step, index) => {
                  const stepsOrder: MagicLinkStep[] = ['select', 'submit', 'pending'];
                  const currentIndex = stepsOrder.indexOf(state.step);
                  return (
                    <div
                      key={step}
                      className={`flex-1 py-3 text-center text-sm font-medium border-b-2 transition-colors ${
                        state.step === step
                          ? 'border-white text-white'
                          : index < currentIndex
                            ? 'border-zinc-500 text-zinc-400'
                            : 'border-transparent text-zinc-500'
                      }`}
                    >
                      {step === 'select' ? 'SELECT TIME' : 'CONFIRM'}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Subhead */}
        {copy.subhead && state.step === 'select' && (
          <p className="text-center mb-6" style={{ color: brand.textMuted }}>
            {copy.subhead}
          </p>
        )}

        {/* Error banner */}
        {state.error && state.step !== 'pending' && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{state.error}</p>
          </div>
        )}

        {/* Select Step */}
        {state.step === 'select' && (
          <SelectStep
            employees={state.employees}
            selectedEmployee={state.selectedEmployee}
            slots={state.slots}
            loading={state.loading}
            selectedDate={state.selectedDate}
            onSelectEmployee={handleEmployeeSelect}
            onSelectSlot={handleSlotSelect}
            onDateChange={handleDateChange}
            supportsEmployeeSelection={capabilities.supportsEmployeeSelection || false}
            brand={brand}
          />
        )}

        {/* Submit Step */}
        {state.step === 'submit' && state.selectedSlot && (
          <SubmitStep
            slot={state.selectedSlot}
            employee={state.selectedEmployee}
            barcode={state.barcode}
            email={state.email}
            phone={state.phone}
            loading={state.loading}
            onBarcodeChange={(v) => setState(s => ({ ...s, barcode: v }))}
            onEmailChange={(v) => setState(s => ({ ...s, email: v }))}
            onPhoneChange={(v) => setState(s => ({ ...s, phone: v }))}
            onSubmit={handleSubmit}
            onBack={handleBack}
            brand={brand}
            copy={copy}
          />
        )}

        {/* Pending Step (after submission) */}
        {state.step === 'pending' && (
          <PendingStep
            email={state.email}
            onReset={handleReset}
            brand={brand}
            copy={copy}
          />
        )}
      </main>

      {/* Footer */}
      {features.showPoweredBy && (
        <footer className="py-6 text-center">
          <p className="text-xs text-gray-400">{copy.footerText}</p>
          {copy.footerEmail && (
            <a href={`mailto:${copy.footerEmail}`} className="text-xs text-gray-400 hover:text-gray-500">
              {copy.footerEmail}
            </a>
          )}
        </footer>
      )}
    </div>
  );
}

// =============================================================================
// SELECT STEP
// =============================================================================

function SelectStep({
  employees,
  selectedEmployee,
  slots,
  loading,
  selectedDate,
  onSelectEmployee,
  onSelectSlot,
  onDateChange,
  supportsEmployeeSelection,
  brand,
}: {
  employees: BookingEmployee[];
  selectedEmployee: BookingEmployee | null;
  slots: TimeSlot[];
  loading: boolean;
  selectedDate: string;
  onSelectEmployee: (employee: BookingEmployee) => void;
  onSelectSlot: (slot: TimeSlot) => void;
  onDateChange: (date: string) => void;
  supportsEmployeeSelection: boolean;
  brand: DerivedBrand;
}) {
  // Group slots by date
  const slotsByDate = slots.reduce((acc, slot) => {
    const date = slot.startTime.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, TimeSlot[]>);

  // Date navigation
  const goToPreviousWeek = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 7);
    onDateChange(date.toISOString().split('T')[0]);
  };

  const goToNextWeek = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 7);
    onDateChange(date.toISOString().split('T')[0]);
  };

  const canGoPrevious = new Date(selectedDate) > new Date();

  return (
    <div className="space-y-6">
      {/* Employee selector */}
      {supportsEmployeeSelection && employees.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: brand.text }}>
            Select Your Trainer
          </h2>
          <div className="flex flex-wrap gap-3">
            {employees.map((employee) => (
              <button
                key={employee.key}
                onClick={() => onSelectEmployee(employee)}
                className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${
                  selectedEmployee?.key === employee.key
                    ? 'border-current text-white'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={
                  selectedEmployee?.key === employee.key
                    ? { backgroundColor: brand.primary, borderColor: brand.primary }
                    : { color: brand.text }
                }
              >
                {employee.name}
                {employee.title && (
                  <span className="block text-xs opacity-75">{employee.title}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time slots */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Date navigation header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: brand.border, backgroundColor: '#f9fafb' }}>
          <button
            onClick={goToPreviousWeek}
            disabled={!canGoPrevious || loading}
            className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: brand.text }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <span className="font-medium" style={{ color: brand.text }}>
            {formatDateRange(selectedDate)}
          </span>
          
          <button
            onClick={goToNextWeek}
            disabled={loading}
            className="p-2 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: brand.text }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: brand.text }}>
            {loading ? 'Loading availability...' : 'Select a Time'}
          </h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div
                className="animate-spin w-8 h-8 border-3 rounded-full"
                style={{ borderColor: `${brand.border} ${brand.border} ${brand.primary} ${brand.primary}` }}
              />
            </div>
          ) : Object.keys(slotsByDate).length === 0 ? (
            <div className="text-center py-12" style={{ color: brand.textMuted }}>
              <p>No available times found for this week.</p>
              <p className="text-sm mt-2">Try another week or a different trainer.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium mb-3" style={{ color: brand.textMuted }}>
                    {formatDate(date)}
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {dateSlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => onSelectSlot(slot)}
                        className="px-3 py-2 text-sm rounded border hover:border-gray-400 transition-colors"
                        style={{ borderColor: brand.border, color: brand.text }}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUBMIT STEP
// =============================================================================

function SubmitStep({
  slot,
  employee,
  barcode,
  email,
  phone,
  loading,
  onBarcodeChange,
  onEmailChange,
  onPhoneChange,
  onSubmit,
  onBack,
  brand,
  copy,
}: {
  slot: TimeSlot;
  employee: BookingEmployee | null;
  barcode: string;
  email: string;
  phone: string;
  loading: boolean;
  onBarcodeChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  brand: DerivedBrand;
  copy: ResolvedBookingCopy;
}) {
  const startTime = new Date(slot.startTime);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-6 border-b" style={{ borderColor: brand.border }}>
        <h2 className="text-xl font-semibold" style={{ color: brand.text }}>
          Confirm Your Session
        </h2>
        <p style={{ color: brand.textMuted }}>
          Enter your details to receive a confirmation email.
        </p>
      </div>

      {/* Selected session info */}
      <div className="p-6 border-b" style={{ borderColor: brand.border, backgroundColor: '#f9fafb' }}>
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 mt-0.5" style={{ color: brand.textMuted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <div className="font-medium" style={{ color: brand.text }}>{slot.title}</div>
            <div style={{ color: brand.textMuted }}>
              {startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div style={{ color: brand.textMuted }}>
              {startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
            {(employee?.name || slot.staffName) && (
              <div className="mt-1" style={{ color: brand.text }}>
                with {employee?.name || slot.staffName}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
            Member Barcode *
          </label>
          <input
            type="text"
            value={barcode}
            onChange={(e) => onBarcodeChange(e.target.value)}
            placeholder="fgj6"
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
            style={{ borderColor: brand.border, backgroundColor: brand.card, color: brand.text }}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
            Email Address *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
            style={{ borderColor: brand.border, backgroundColor: brand.card, color: brand.text }}
            disabled={loading}
          />
          <p className="text-xs mt-1" style={{ color: brand.textMuted }}>
            Must match the email on your membership
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
            Last 4 Digits of Phone *
          </label>
          <input
            type="text"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
            maxLength={4}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2"
            style={{ borderColor: brand.border, backgroundColor: brand.card, color: brand.text }}
            disabled={loading}
          />
          <p className="text-xs mt-1" style={{ color: brand.textMuted }}>
            For verification purposes
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 border-t flex gap-4" style={{ borderColor: brand.border, backgroundColor: '#f9fafb' }}>
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 border rounded font-medium hover:bg-white disabled:opacity-50"
          style={{ borderColor: brand.border, color: brand.text }}
        >
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 py-3 text-white font-medium rounded disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ backgroundColor: brand.primary }}
        >
          {loading ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              <span>Submitting...</span>
            </>
          ) : (
            copy.submitButton
          )}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// PENDING STEP
// =============================================================================

function PendingStep({
  email,
  onReset,
  brand,
  copy,
}: {
  email: string;
  onReset: () => void;
  brand: DerivedBrand;
  copy: ResolvedBookingCopy;
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden text-center">
      <div className="p-8">
        {/* Success icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: `${brand.success}20` }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: brand.success }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold mb-3" style={{ color: brand.text }}>
          {copy.successTitle}
        </h2>

        <p className="mb-2" style={{ color: brand.textMuted }}>
          {copy.successMessage}
        </p>

        <p className="text-sm mb-6" style={{ color: brand.textMuted }}>
          Sent to: <strong style={{ color: brand.text }}>{email}</strong>
        </p>

        <div
          className="p-4 rounded-lg text-sm text-left space-y-2 mb-6"
          style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
        >
          <p className="font-medium">What happens next?</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Check your inbox (and spam folder) for a confirmation email</li>
            <li>Click the link in the email to confirm your booking</li>
            <li>The link expires in 15 minutes</li>
          </ul>
        </div>

        <button
          onClick={onReset}
          className="px-6 py-2 border rounded font-medium hover:bg-gray-50 transition-colors"
          style={{ borderColor: brand.border, color: brand.text }}
        >
          Book Another Session
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// UTILITIES
// =============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatDateRange(startDateStr: string): string {
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', options)} - ${end.getDate()}`;
  }
  
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
