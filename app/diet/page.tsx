'use client';

import { useState } from 'react';
import { DietCalculatorInputs, DietCalculatorOutput, calculateDietPlan } from '@/app/_lib/diet-calculator';
import DietCalculatorForm from './_components/DietCalculatorForm';
import DietResults from './_components/DietResults';
import EducationSection from './_components/EducationSection';

export default function DietPage() {
  const [results, setResults] = useState<DietCalculatorOutput | null>(null);

  const handleCalculate = (inputs: DietCalculatorInputs) => {
    try {
      const calculatedResults = calculateDietPlan(inputs);
      setResults(calculatedResults);
    } catch (error) {
      console.error('Calculation error:', error);
      alert('There was an error calculating your plan. Please check your inputs.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 py-20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_100%)]" />
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8">
            Your Personalized<br />Nutrition Plan
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-light">
            Calculate your macros, hand portions, and meal structure based on your goals—no guesswork required.
          </p>
        </div>
      </section>

      {/* Calculator Section */}
      <section className="py-20 px-6 border-t border-zinc-900/50">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Calculate Your Plan</h2>
            <p className="text-zinc-400">
              Fill in your details below to get your personalized macro targets and hand portions.
            </p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 md:p-8">
            <DietCalculatorForm onCalculate={handleCalculate} />
          </div>
        </div>
      </section>

      {/* Results Section */}
      {results && (
        <section className="py-20 px-6 border-t border-zinc-900/50">
          <div className="max-w-4xl mx-auto">
            <DietResults results={results} />
          </div>
        </section>
      )}

      {/* Education Section */}
      {results && (
        <section className="py-20 px-6 border-t border-zinc-900/50 bg-zinc-900/30">
          <div className="max-w-5xl mx-auto">
            <EducationSection perMealPortions={results.handPortionsPerMeal} />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-900/50 py-12 px-6">
        <div className="max-w-6xl mx-auto text-center text-zinc-600 text-sm">
          <p>© 2024 Cyclic Strength. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

