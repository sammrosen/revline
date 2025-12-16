'use client';

import { useEffect, useRef } from 'react';
import { DietCalculatorOutput } from '@/app/_lib/diet-calculator';

interface DietResultsProps {
  results: DietCalculatorOutput;
}

export default function DietResults({ results }: DietResultsProps) {
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Smooth scroll to results after calculation
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatHandPortion = (value: number): string => {
    if (value % 1 === 0) {
      return value.toString();
    }
    return value.toFixed(2).replace(/\.?0+$/, '');
  };

  return (
    <div ref={resultsRef} className="space-y-8">
      {/* Top Summary */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 md:p-8">
        <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Your Personalized Plan</h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Maintenance Calories</p>
            <p className="text-2xl font-bold text-zinc-50">{results.maintenanceCalories.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Goal Calories</p>
            <p className="text-3xl font-bold text-white">{results.goalCalories.toLocaleString()}</p>
          </div>
        </div>

        <div className="text-center border-t border-zinc-800 pt-6">
          <p className="text-sm text-zinc-400 mb-2">Weekly Rate</p>
          <p className="text-xl font-semibold text-zinc-50">
            {results.weeklyChangeLb === 0
              ? 'Maintaining current weight'
              : results.weeklyChangeLb < 0
              ? `Losing ${Math.abs(results.weeklyChangeLb)} lb/week`
              : `Gaining ${results.weeklyChangeLb} lb/week`}
          </p>
        </div>

        {results.timeToGoal.weeks !== null && results.timeToGoal.validDirection && (
          <div className="text-center border-t border-zinc-800 pt-6 mt-6">
            <p className="text-sm text-zinc-400 mb-1">Estimated Time to Goal</p>
            <p className="text-xl font-semibold text-zinc-50">
              ~{results.timeToGoal.weeks} {results.timeToGoal.weeks === 1 ? 'week' : 'weeks'}
            </p>
            {results.timeToGoal.targetDate && (
              <p className="text-sm text-zinc-400 mt-1">
                Target: {formatDate(results.timeToGoal.targetDate)}
              </p>
            )}
          </div>
        )}

        {!results.timeToGoal.validDirection && (
          <div className="text-center border-t border-zinc-800 pt-6 mt-6">
            <p className="text-sm text-amber-400">
              ⚠️ Your goal weight direction doesn&apos;t match your weekly rate. Adjust your slider to align with your goal.
            </p>
          </div>
        )}
      </div>

      {/* Protein Targets */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4">Protein Target</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Minimum</p>
            <p className="text-lg font-semibold text-zinc-50">{results.protein.min}g/day</p>
          </div>
          <div className="text-center border-x border-zinc-800">
            <p className="text-sm text-zinc-500 mb-1">Target</p>
            <p className="text-xl font-bold text-white">{results.protein.mid}g/day</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Maximum</p>
            <p className="text-lg font-semibold text-zinc-50">{results.protein.max}g/day</p>
          </div>
        </div>
      </div>

      {/* Carbs and Fats */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Carbohydrates</h3>
          <p className="text-3xl font-bold text-zinc-50">{results.carbsGrams}g/day</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Fats</h3>
          <p className="text-3xl font-bold text-zinc-50">{results.fatGrams}g/day</p>
        </div>
      </div>

      {/* Daily Hand Portions */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4">Daily Hand Portions</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Protein</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatHandPortion(results.handPortionsDay.proteinPalms)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">palms</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Carbs</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatHandPortion(results.handPortionsDay.carbCups)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">cupped hands</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Fats</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatHandPortion(results.handPortionsDay.fatThumbs)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">thumbs</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Veggies</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatHandPortion(results.handPortionsDay.veggieFists)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">fists</p>
          </div>
        </div>
      </div>

      {/* Per-Meal Hand Portions */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-xl font-bold mb-4">Per-Meal Hand Portions</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Protein</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatHandPortion(results.handPortionsPerMeal.proteinPalms)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">palms</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Carbs</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatHandPortion(results.handPortionsPerMeal.carbCups)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">cupped hands</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Fats</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatHandPortion(results.handPortionsPerMeal.fatThumbs)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">thumbs</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-zinc-500 mb-1">Veggies</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatHandPortion(results.handPortionsPerMeal.veggieFists)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">fists</p>
          </div>
        </div>
      </div>
    </div>
  );
}






