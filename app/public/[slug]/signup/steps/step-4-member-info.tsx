'use client';

/**
 * Step 4: Member Info
 * 
 * Collects detailed member information:
 * - Current info display (name, email, phone from step 2)
 * - Address fields
 * - Birthday
 * - Gender
 * - Home phone (optional)
 * 
 * Layout: Form on left, sidebar summary on right
 */

import type { SignupPlan } from '@/app/_lib/types';
import type { SignupFormState, DerivedBrand, TextClasses } from '../client';
import type { ResolvedSignupClub } from '@/app/_lib/config';
import { SidebarSummary } from './sidebar-summary';

// US States for dropdown
const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// Months for birthday
const MONTHS = [
  { value: '', label: 'Month' },
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

// Days 1-31
const DAYS = [
  { value: '', label: 'Day' },
  ...Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: String(i + 1),
  })),
];

// Years (18-100 years ago)
const currentYear = new Date().getFullYear();
const YEARS = [
  { value: '', label: 'Year' },
  ...Array.from({ length: 83 }, (_, i) => ({
    value: String(currentYear - 18 - i),
    label: String(currentYear - 18 - i),
  })),
];

// Gender options
const GENDERS = [
  { value: '', label: 'Select' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

interface MemberInfoStepProps {
  formState: SignupFormState;
  updateForm: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  brand: DerivedBrand;
  typo: TextClasses;
  club: ResolvedSignupClub;
  selectedPlan: SignupPlan;
}

export function MemberInfoStep({
  formState,
  updateForm,
  onNext,
  onBack,
  loading,
  brand,
  typo,
  club,
  selectedPlan,
}: MemberInfoStepProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main form */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-6" style={{ backgroundColor: brand.primary }}>
            <h2 className={`${typo.sectionHeader} uppercase tracking-wide text-white`}>
              Member Info
            </h2>
          </div>
          
          <div className="p-8 space-y-6">
            {/* Display info from step 2 (readonly) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block ${typo.label} text-gray-500 mb-2`}>
                  First Name
                </label>
                <p className="px-4 py-4 bg-gray-50 rounded-lg font-medium" style={{ color: brand.text }}>
                  {formState.firstName}
                </p>
              </div>
              <div>
                <label className={`block ${typo.label} text-gray-500 mb-2`}>
                  Last Name
                </label>
                <p className="px-4 py-4 bg-gray-50 rounded-lg font-medium" style={{ color: brand.text }}>
                  {formState.lastName}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block ${typo.label} text-gray-500 mb-2`}>
                  Email
                </label>
                <p className="px-4 py-4 bg-gray-50 rounded-lg text-sm font-medium" style={{ color: brand.primary }}>
                  {formState.email}
                </p>
              </div>
              <div>
                <label className={`block ${typo.label} text-gray-500 mb-2`}>
                  Mobile Phone
                </label>
                <p className="px-4 py-4 bg-gray-50 rounded-lg font-medium" style={{ color: brand.primary }}>
                  {formState.phone}
                </p>
              </div>
            </div>
            
            {/* Address fields */}
            <div className="pt-6 border-t" style={{ borderColor: brand.border }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className={`block ${typo.label} text-gray-600 mb-2`}>
                    Mailing Address *
                  </label>
                  <input
                    type="text"
                    value={formState.address}
                    onChange={(e) => updateForm('address', e.target.value)}
                    className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                    style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                    placeholder="123 Main Street"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className={`block ${typo.label} text-gray-600 mb-2`}>
                    City *
                  </label>
                  <input
                    type="text"
                    value={formState.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                    style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                    placeholder="City"
                    disabled={loading}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block ${typo.label} text-gray-600 mb-2`}>
                      State *
                    </label>
                    <select
                      value={formState.state}
                      onChange={(e) => updateForm('state', e.target.value)}
                      className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer"
                      style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                      disabled={loading}
                    >
                      {US_STATES.map((state) => (
                        <option key={state.value} value={state.value}>
                          {state.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className={`block ${typo.label} text-gray-600 mb-2`}>
                      ZIP Code *
                    </label>
                    <input
                      type="text"
                      value={formState.zipCode}
                      onChange={(e) => updateForm('zipCode', e.target.value.replace(/\D/g, '').slice(0, 5))}
                      className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                      style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                      placeholder="12345"
                      maxLength={5}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Birthday */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Birthday *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={formState.birthMonth}
                    onChange={(e) => updateForm('birthMonth', e.target.value)}
                    className="px-3 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 text-sm focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer"
                    style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                    disabled={loading}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={formState.birthDay}
                    onChange={(e) => updateForm('birthDay', e.target.value)}
                    className="px-3 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 text-sm focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer"
                    style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                    disabled={loading}
                  >
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  <select
                    value={formState.birthYear}
                    onChange={(e) => updateForm('birthYear', e.target.value)}
                    className="px-3 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 text-sm focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer"
                    style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                    disabled={loading}
                  >
                    {YEARS.map((y) => (
                      <option key={y.value} value={y.value}>{y.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Gender
                </label>
                <select
                  value={formState.gender}
                  onChange={(e) => updateForm('gender', e.target.value)}
                  className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors appearance-none cursor-pointer"
                  style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                  disabled={loading}
                >
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Home phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={`block ${typo.label} text-gray-600 mb-2`}>
                  Home Phone (optional)
                </label>
                <input
                  type="tel"
                  value={formState.homePhone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    let formatted = digits;
                    if (digits.length > 6) {
                      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
                    } else if (digits.length > 3) {
                      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
                    } else if (digits.length > 0) {
                      formatted = `(${digits}`;
                    }
                    updateForm('homePhone', formatted);
                  }}
                  className="w-full px-4 py-4 bg-gray-100 border-0 rounded-lg text-gray-900 placeholder:text-gray-500 focus:bg-gray-50 focus:ring-2 focus:outline-none transition-colors"
                  style={{ '--tw-ring-color': `${brand.primary}40` } as React.CSSProperties}
                  placeholder="(555) 123-4567"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="px-8 py-6 border-t flex justify-between" style={{ borderColor: brand.border, backgroundColor: '#f9fafb' }}>
            <button
              onClick={onBack}
              disabled={loading}
              className="px-6 py-3 bg-gray-100 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
              style={{ color: brand.text }}
            >
              Back
            </button>
            <button
              onClick={onNext}
              disabled={loading}
              className="px-8 py-4 text-white font-semibold rounded-lg disabled:opacity-50 transition-all hover:shadow-lg"
              style={{ backgroundColor: brand.primary }}
            >
              Proceed to Payment
            </button>
          </div>
        </div>
      </div>
      
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <SidebarSummary
          club={club}
          selectedPlan={selectedPlan}
          brand={brand}
        />
      </div>
    </div>
  );
}
