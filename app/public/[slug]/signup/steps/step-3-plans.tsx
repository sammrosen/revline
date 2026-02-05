'use client';

/**
 * Step 3: Select Plan
 * 
 * Displays membership plan cards with:
 * - Plan name and price
 * - Benefits list
 * - Pricing details
 * - Promotional notes
 * - Payment summary
 */

import type { SignupPlan } from '@/app/_lib/types';
import type { DerivedBrand } from '../client';

interface SelectPlanStepProps {
  plans: SignupPlan[];
  selectedPlanId: string | null;
  promoCode: string;
  onSelectPlan: (planId: string) => void;
  onPromoCodeChange: (code: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  brand: DerivedBrand;
  showPromoCode: boolean;
}

export function SelectPlanStep({
  plans,
  selectedPlanId,
  promoCode,
  onSelectPlan,
  onPromoCodeChange,
  onNext,
  onBack,
  loading,
  brand,
  showPromoCode,
}: SelectPlanStepProps) {
  return (
    <div className="space-y-6">
      {/* Promo code input */}
      {showPromoCode && (
        <div className="flex justify-end">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
              className="px-3 py-2 border rounded text-sm"
              style={{ borderColor: brand.border, color: brand.text }}
              placeholder="Enter Promo Code"
              disabled={loading}
            />
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white rounded"
              style={{ backgroundColor: brand.primary }}
              disabled={loading || !promoCode.trim()}
            >
              Apply
            </button>
          </div>
        </div>
      )}
      
      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-lg shadow-lg overflow-hidden transition-all ${
                isSelected ? 'ring-2 ring-offset-2' : 'hover:shadow-xl'
              }`}
              style={isSelected ? { 
                boxShadow: `0 0 0 2px ${brand.primary}`,
                outline: `2px solid ${brand.primary}`,
                outlineOffset: '2px'
              } : undefined}
            >
              {/* Plan header */}
              <div className="p-4 text-center bg-zinc-800 text-white">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
              </div>
              
              {/* Price */}
              <div className="p-4 text-center border-b" style={{ borderColor: brand.border }}>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold" style={{ color: brand.text }}>
                    ${plan.price.toFixed(2)}
                  </span>
                  <span className="text-sm" style={{ color: brand.textMuted }}>
                    /{plan.period === 'month' ? 'mo' : 'yr'}
                  </span>
                </div>
                
                {/* Select button */}
                <button
                  onClick={() => onSelectPlan(plan.id)}
                  disabled={loading}
                  className={`mt-3 px-6 py-2 rounded font-medium transition-colors ${
                    isSelected
                      ? 'text-white'
                      : 'border text-zinc-700 hover:bg-zinc-50'
                  }`}
                  style={isSelected ? { backgroundColor: brand.primary } : { borderColor: brand.border }}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              </div>
              
              {/* Plan image */}
              {plan.image && (
                <div className="p-4 border-b" style={{ borderColor: brand.border }}>
                  <img
                    src={plan.image}
                    alt={plan.name}
                    className="w-full h-32 object-cover rounded"
                  />
                </div>
              )}
              
              {/* Benefits */}
              <div className="p-4 border-b" style={{ borderColor: brand.border }}>
                <h4 className="font-semibold text-sm mb-2" style={{ color: brand.primary }}>
                  Member Benefits:
                </h4>
                <ul className="space-y-1">
                  {plan.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: brand.text }}>
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: brand.primary }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Promo note */}
              {plan.promoNote && (
                <div className="px-4 py-2" style={{ backgroundColor: brand.primary + '15' }}>
                  <p className="text-sm font-semibold text-center" style={{ color: brand.primary }}>
                    {plan.promoNote}
                  </p>
                </div>
              )}
              
              {/* Pricing details */}
              <div className="p-4 border-b" style={{ borderColor: brand.border }}>
                <h4 className="font-semibold text-sm mb-2" style={{ color: brand.text }}>
                  Pricing Details:
                </h4>
                <ul className="space-y-1">
                  {plan.pricingDetails.map((detail, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: brand.text }}>
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: brand.primary }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span>
                        {detail.label}: {' '}
                        {detail.strikethrough && (
                          <span className="line-through text-zinc-400 mr-1">{detail.strikethrough}</span>
                        )}
                        <span className={detail.strikethrough ? 'font-semibold' : ''}>{detail.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Disclaimer */}
              {plan.disclaimer && (
                <div className="p-4 text-xs" style={{ color: brand.textMuted }}>
                  *{plan.disclaimer}
                </div>
              )}
              
              {/* Payment summary */}
              <div className="p-4 bg-zinc-50">
                <h4 className="font-semibold text-sm mb-2 text-center" style={{ color: brand.text }}>
                  Payment Details
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: brand.textMuted }}>Due Today</span>
                    <span className="font-medium" style={{ color: brand.primary }}>
                      ${plan.paymentDetails.dueToday.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: brand.textMuted }}>Recurring</span>
                    <span className="font-medium" style={{ color: brand.primary }}>
                      ${plan.paymentDetails.recurring.toFixed(2)}
                    </span>
                  </div>
                  {plan.paymentDetails.fees > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: brand.textMuted }}>Fees</span>
                      <span className="font-medium" style={{ color: brand.primary }}>
                        ${plan.paymentDetails.fees.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          disabled={loading}
          className="px-6 py-3 border rounded-lg font-medium hover:bg-zinc-50 disabled:opacity-50"
          style={{ borderColor: brand.border, color: brand.text }}
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={loading || !selectedPlanId}
          className="px-8 py-3 text-white font-medium rounded-lg disabled:opacity-50"
          style={{ backgroundColor: brand.primary }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
