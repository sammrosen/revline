'use client';

import { useState, FormEvent } from 'react';
import { DietCalculatorInputs, SLIDER_SNAP_POINTS, getSliderLabel } from '@/app/_lib/diet-calculator';

interface DietCalculatorFormProps {
  onCalculate: (inputs: DietCalculatorInputs) => void;
}

export default function DietCalculatorForm({ onCalculate }: DietCalculatorFormProps) {
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [age, setAge] = useState<string>('');
  const [heightUnit, setHeightUnit] = useState<'imperial' | 'metric'>('imperial');
  const [heightFeet, setHeightFeet] = useState<string>('');
  const [heightInches, setHeightInches] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [currentWeightLb, setCurrentWeightLb] = useState<string>('');
  const [goalWeightLb, setGoalWeightLb] = useState<string>('');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'lightly-active' | 'moderately-active' | 'very-active'>('moderately-active');
  const [mealsPerDay, setMealsPerDay] = useState<2 | 3 | 4 | 5>(3);
  const [weeklyChangeLb, setWeeklyChangeLb] = useState<number>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!age || parseInt(age) < 18 || parseInt(age) > 90) {
      newErrors.age = 'Please enter a valid age (18-90)';
    }

    if (heightUnit === 'imperial') {
      if (!heightFeet || parseInt(heightFeet) < 3 || parseInt(heightFeet) > 8) {
        newErrors.heightFeet = 'Please enter valid feet (3-8)';
      }
      if (!heightInches || parseInt(heightInches) < 0 || parseInt(heightInches) > 11) {
        newErrors.heightInches = 'Please enter valid inches (0-11)';
      }
    } else {
      if (!heightCm || parseInt(heightCm) < 100 || parseInt(heightCm) > 250) {
        newErrors.heightCm = 'Please enter valid height in cm (100-250)';
      }
    }

    if (!currentWeightLb || parseFloat(currentWeightLb) < 80 || parseFloat(currentWeightLb) > 500) {
      newErrors.currentWeightLb = 'Please enter a valid current weight (80-500 lbs)';
    }

    if (!goalWeightLb || parseFloat(goalWeightLb) < 80 || parseFloat(goalWeightLb) > 500) {
      newErrors.goalWeightLb = 'Please enter a valid goal weight (80-500 lbs)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const inputs: DietCalculatorInputs = {
      sex,
      age: parseInt(age),
      currentWeightLb: parseFloat(currentWeightLb),
      goalWeightLb: parseFloat(goalWeightLb),
      activityLevel,
      mealsPerDay,
      weeklyChangeLb,
    };

    if (heightUnit === 'imperial') {
      inputs.heightFeet = parseInt(heightFeet);
      inputs.heightInches = parseInt(heightInches);
    } else {
      inputs.heightCm = parseInt(heightCm);
    }

    onCalculate(inputs);
  };

  const findNearestSnapPoint = (value: number): number => {
    return SLIDER_SNAP_POINTS.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const snapped = findNearestSnapPoint(value);
    setWeeklyChangeLb(snapped);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sex */}
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-2">Sex</label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setSex('male')}
            className={`flex-1 px-6 py-3 rounded-lg border transition-all duration-200 ${
              sex === 'male'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-50'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            Male
          </button>
          <button
            type="button"
            onClick={() => setSex('female')}
            className={`flex-1 px-6 py-3 rounded-lg border transition-all duration-200 ${
              sex === 'female'
                ? 'bg-zinc-800 border-zinc-700 text-zinc-50'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            Female
          </button>
        </div>
      </div>

      {/* Age */}
      <div>
        <label htmlFor="age" className="block text-sm font-medium text-zinc-400 mb-2">
          Age (years)
        </label>
        <input
          type="number"
          id="age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          min="18"
          max="90"
          className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
          placeholder="25"
        />
        {errors.age && <p className="mt-1 text-sm text-red-400">{errors.age}</p>}
      </div>

      {/* Height */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-zinc-400">Height</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHeightUnit('imperial')}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                heightUnit === 'imperial'
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              ft/in
            </button>
            <button
              type="button"
              onClick={() => setHeightUnit('metric')}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                heightUnit === 'metric'
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              cm
            </button>
          </div>
        </div>
        {heightUnit === 'imperial' ? (
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="number"
                value={heightFeet}
                onChange={(e) => setHeightFeet(e.target.value)}
                min="3"
                max="8"
                className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
                placeholder="5"
              />
              <p className="mt-1 text-xs text-zinc-500">feet</p>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={heightInches}
                onChange={(e) => setHeightInches(e.target.value)}
                min="0"
                max="11"
                className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
                placeholder="10"
              />
              <p className="mt-1 text-xs text-zinc-500">inches</p>
            </div>
          </div>
        ) : (
          <div>
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              min="100"
              max="250"
              className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
              placeholder="178"
            />
            {errors.heightCm && <p className="mt-1 text-sm text-red-400">{errors.heightCm}</p>}
          </div>
        )}
        {(errors.heightFeet || errors.heightInches) && (
          <p className="mt-1 text-sm text-red-400">{errors.heightFeet || errors.heightInches}</p>
        )}
      </div>

      {/* Current Weight */}
      <div>
        <label htmlFor="currentWeight" className="block text-sm font-medium text-zinc-400 mb-2">
          Current Weight (lbs)
        </label>
        <input
          type="number"
          id="currentWeight"
          value={currentWeightLb}
          onChange={(e) => setCurrentWeightLb(e.target.value)}
          min="80"
          max="500"
          step="0.1"
          className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
          placeholder="180"
        />
        {errors.currentWeightLb && <p className="mt-1 text-sm text-red-400">{errors.currentWeightLb}</p>}
      </div>

      {/* Goal Weight */}
      <div>
        <label htmlFor="goalWeight" className="block text-sm font-medium text-zinc-400 mb-2">
          Goal Weight (lbs)
        </label>
        <input
          type="number"
          id="goalWeight"
          value={goalWeightLb}
          onChange={(e) => setGoalWeightLb(e.target.value)}
          min="80"
          max="500"
          step="0.1"
          className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
          placeholder="165"
        />
        {errors.goalWeightLb && <p className="mt-1 text-sm text-red-400">{errors.goalWeightLb}</p>}
      </div>

      {/* Activity Level */}
      <div>
        <label htmlFor="activityLevel" className="block text-sm font-medium text-zinc-400 mb-2">
          Activity / Training Level
        </label>
        <select
          id="activityLevel"
          value={activityLevel}
          onChange={(e) => setActivityLevel(e.target.value as DietCalculatorInputs['activityLevel'])}
          className="w-full px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-50 focus:outline-none focus:border-zinc-700 transition-colors duration-200 rounded-lg"
        >
          <option value="sedentary">Sedentary (little or no exercise)</option>
          <option value="lightly-active">Lightly active (1-3 training days/week)</option>
          <option value="moderately-active">Moderately active (3-5 days/week)</option>
          <option value="very-active">Very active (6-7 days/week/manual job)</option>
        </select>
      </div>

      {/* Meals Per Day */}
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-2">Meals Per Day</label>
        <div className="grid grid-cols-4 gap-2">
          {([2, 3, 4, 5] as const).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setMealsPerDay(num)}
              className={`px-4 py-3 rounded-lg border transition-all duration-200 ${
                mealsPerDay === num
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-50'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly Goal Slider */}
      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-2">
          Weekly Goal: <span className="text-zinc-50 font-semibold">{getSliderLabel(weeklyChangeLb)}</span>
        </label>
        <input
          type="range"
          min="-2.0"
          max="2.0"
          step="0.01"
          value={weeklyChangeLb}
          onChange={handleSliderChange}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-50"
          style={{
            background: `linear-gradient(to right, rgb(39 39 42) 0%, rgb(39 39 42) ${((weeklyChangeLb + 2) / 4) * 100}%, rgb(63 63 70) ${((weeklyChangeLb + 2) / 4) * 100}%, rgb(63 63 70) 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>Fast Loss (-2.0)</span>
          <span>Maintain (0)</span>
          <span>Fast Gain (+2.0)</span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-100 transition-all duration-200 shadow-lg shadow-white/10 hover:shadow-white/20"
      >
        Generate Plan
      </button>
    </form>
  );
}






