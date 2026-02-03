'use client';

/**
 * Sidebar Summary Component
 * 
 * Reusable right sidebar showing:
 * - Club info (collapsible)
 * - Payment summary (collapsible)
 * - Plan details with image and benefits (collapsible)
 */

import { useState } from 'react';
import type { SignupPlan } from '@/app/_lib/types';
import type { DerivedBrand } from '../client';
import type { ResolvedSignupClub } from '@/app/_lib/config';

interface SidebarSummaryProps {
  club: ResolvedSignupClub;
  selectedPlan: SignupPlan;
  brand: DerivedBrand;
}

export function SidebarSummary({
  club,
  selectedPlan,
  brand,
}: SidebarSummaryProps) {
  const [showPayment, setShowPayment] = useState(false);
  const [showPlanDetails, setShowPlanDetails] = useState(true);

  return (
    <div className="space-y-4">
      {/* Club Info */}
      <div className="bg-zinc-800 text-white rounded-lg overflow-hidden">
        <div className="px-4 py-3 font-semibold text-center">
          Club Info
        </div>
        <div className="px-4 py-3 bg-zinc-700 text-center text-sm">
          <p className="font-medium">{club.name}</p>
          <p className="text-zinc-300">{club.address}</p>
          <p className="text-zinc-300">{club.city}, {club.state} {club.zip}</p>
        </div>
      </div>
      
      {/* Payment Summary (collapsible) */}
      <div className="bg-zinc-800 text-white rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPayment(!showPayment)}
          className="w-full px-4 py-3 font-semibold text-center flex items-center justify-center gap-2"
        >
          Payment Summary
          <svg 
            className={`w-4 h-4 transition-transform ${showPayment ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showPayment && (
          <div className="px-4 py-3 bg-zinc-700 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-300">Due Today</span>
              <span className="font-medium">${selectedPlan.paymentDetails.dueToday.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-300">Monthly</span>
              <span className="font-medium">${selectedPlan.paymentDetails.recurring.toFixed(2)}</span>
            </div>
            {selectedPlan.paymentDetails.fees > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-300">Fees</span>
                <span className="font-medium">${selectedPlan.paymentDetails.fees.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Plan Details (collapsible) */}
      <div className="bg-zinc-800 text-white rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPlanDetails(!showPlanDetails)}
          className="w-full px-4 py-3 font-semibold text-center flex items-center justify-center gap-2"
        >
          See Plan Details
          <svg 
            className={`w-4 h-4 transition-transform ${showPlanDetails ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showPlanDetails && (
          <div className="p-4 bg-white text-zinc-800">
            {/* Plan image */}
            {selectedPlan.image && (
              <img
                src={selectedPlan.image}
                alt={selectedPlan.name}
                className="w-full h-32 object-cover rounded mb-4"
              />
            )}
            
            {/* Plan name and price */}
            <div className="text-center mb-4">
              <h4 className="font-semibold">{selectedPlan.name}</h4>
              <p className="text-lg font-bold" style={{ color: brand.primary }}>
                ${selectedPlan.price.toFixed(2)}/{selectedPlan.period === 'month' ? 'mo' : 'yr'}
              </p>
            </div>
            
            {/* Benefits */}
            <div className="mb-4">
              <h5 className="font-semibold text-sm mb-2" style={{ color: brand.primary }}>
                Member Benefits:
              </h5>
              <ul className="space-y-1 text-sm">
                {selectedPlan.benefits.slice(0, 10).map((benefit, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: brand.primary }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Promo note */}
            {selectedPlan.promoNote && (
              <p className="text-sm font-semibold text-center" style={{ color: brand.primary }}>
                {selectedPlan.promoNote}
              </p>
            )}
            
            {/* Pricing details */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: brand.border }}>
              <h5 className="font-semibold text-sm mb-2">Pricing Details:</h5>
              <ul className="space-y-1 text-sm">
                {selectedPlan.pricingDetails.map((detail, idx) => (
                  <li key={idx} className="flex items-center gap-2">
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
            {selectedPlan.disclaimer && (
              <p className="text-xs mt-4 italic" style={{ color: brand.textMuted }}>
                *{selectedPlan.disclaimer}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
