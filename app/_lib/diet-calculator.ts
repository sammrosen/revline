/**
 * Diet Calculator - Deterministic Macro and Hand Portion Calculator
 * Based on Mifflin-St Jeor BMR and activity multipliers
 */

export interface DietCalculatorInputs {
  sex: 'male' | 'female';
  age: number;
  heightFeet?: number;
  heightInches?: number;
  heightCm?: number;
  currentWeightLb: number;
  goalWeightLb: number;
  activityLevel: 'sedentary' | 'lightly-active' | 'moderately-active' | 'very-active';
  mealsPerDay: 2 | 3 | 4 | 5;
  weeklyChangeLb: number; // -2.0 to +2.0, negative = loss, positive = gain
}

export interface DietCalculatorOutput {
  maintenanceCalories: number;
  goalCalories: number;
  weeklyChangeLb: number;
  protein: {
    min: number;
    max: number;
    mid: number;
  };
  carbsGrams: number;
  fatGrams: number;
  handPortionsDay: {
    proteinPalms: number;
    carbCups: number;
    fatThumbs: number;
    veggieFists: number;
  };
  handPortionsPerMeal: {
    proteinPalms: number;
    carbCups: number;
    fatThumbs: number;
    veggieFists: number;
  };
  timeToGoal: {
    weeks: number | null;
    targetDate: string | null;
    validDirection: boolean;
  };
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  'lightly-active': 1.375,
  'moderately-active': 1.55,
  'very-active': 1.725,
} as const;

/**
 * Round to nearest quarter (0.25 increments)
 */
function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

/**
 * Convert feet and inches to centimeters
 */
function feetInchesToCm(feet: number, inches: number): number {
  return feet * 30.48 + inches * 2.54;
}

/**
 * Calculate BMR using Mifflin-St Jeor equation
 */
function calculateBMR(sex: 'male' | 'female', weightKg: number, heightCm: number, age: number): number {
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
}

/**
 * Calculate macro split percentages based on weekly change rate
 */
function getMacroSplit(weeklyChangeLb: number): { fatShare: number; carbShare: number } {
  if (weeklyChangeLb <= -0.75) {
    // Aggressive cut
    return { fatShare: 0.40, carbShare: 0.60 };
  } else if (weeklyChangeLb < 0) {
    // Mild cut
    return { fatShare: 0.35, carbShare: 0.65 };
  } else if (weeklyChangeLb === 0) {
    // Maintenance
    return { fatShare: 0.35, carbShare: 0.65 };
  } else if (weeklyChangeLb <= 0.75) {
    // Mild gain
    return { fatShare: 0.30, carbShare: 0.70 };
  } else {
    // Aggressive gain
    return { fatShare: 0.25, carbShare: 0.75 };
  }
}

/**
 * Main calculator function
 */
export function calculateDietPlan(inputs: DietCalculatorInputs): DietCalculatorOutput {
  // 1. Unit conversions
  const weightKg = inputs.currentWeightLb / 2.20462;
  
  let heightCm: number;
  if (inputs.heightCm !== undefined) {
    heightCm = inputs.heightCm;
  } else if (inputs.heightFeet !== undefined && inputs.heightInches !== undefined) {
    heightCm = feetInchesToCm(inputs.heightFeet, inputs.heightInches);
  } else {
    throw new Error('Height must be provided either in cm or feet/inches');
  }

  // 2. Calculate BMR
  const bmr = calculateBMR(inputs.sex, weightKg, heightCm, inputs.age);
  const bmrRounded = Math.round(bmr);

  // 3. Calculate maintenance calories (TDEE)
  const activityFactor = ACTIVITY_MULTIPLIERS[inputs.activityLevel];
  const maintenanceCalories = Math.round(bmrRounded * activityFactor);

  // 4. Calculate goal calories from weekly change
  const weeklyCalorieDelta = inputs.weeklyChangeLb * 3500;
  const dailyCalorieDelta = weeklyCalorieDelta / 7;
  const goalCalories = Math.round(maintenanceCalories + dailyCalorieDelta);

  // 5. Calculate protein targets
  const proteinMin = Math.round(inputs.currentWeightLb * 0.8);
  const proteinMax = Math.round(inputs.currentWeightLb * 1.0);
  const proteinMid = Math.round(inputs.currentWeightLb * 0.9);
  const proteinCalories = proteinMid * 4;

  // 6. Calculate carbs and fats
  let remainingCalories = goalCalories - proteinCalories;
  if (remainingCalories < 0) {
    remainingCalories = 0;
  }

  const { fatShare, carbShare } = getMacroSplit(inputs.weeklyChangeLb);
  const fatCalories = remainingCalories * fatShare;
  const carbCalories = remainingCalories * carbShare;

  const fatGrams = Math.round(fatCalories / 9);
  const carbGrams = Math.round(carbCalories / 4);

  // 7. Calculate daily hand portions
  let proteinPalmsDay = proteinMid / 25;
  let carbCupsDay = carbGrams / 25;
  let fatThumbsDay = fatGrams / 10;
  
  // Veggie fists: mealsPerDay * 1.5, clamped between 3 and 8
  let veggieFistsDay = inputs.mealsPerDay * 1.5;
  veggieFistsDay = Math.max(3, Math.min(8, veggieFistsDay));

  // Round to quarters
  proteinPalmsDay = roundToQuarter(proteinPalmsDay);
  carbCupsDay = roundToQuarter(carbCupsDay);
  fatThumbsDay = roundToQuarter(fatThumbsDay);
  veggieFistsDay = roundToQuarter(veggieFistsDay);

  // Enforce minimums
  proteinPalmsDay = Math.max(proteinPalmsDay, 2);
  veggieFistsDay = Math.max(veggieFistsDay, 3);
  carbCupsDay = Math.max(carbCupsDay, 0);
  fatThumbsDay = Math.max(fatThumbsDay, 0);

  // 8. Calculate per-meal hand portions
  let proteinPalmsPerMeal = roundToQuarter(proteinPalmsDay / inputs.mealsPerDay);
  let carbCupsPerMeal = roundToQuarter(carbCupsDay / inputs.mealsPerDay);
  let fatThumbsPerMeal = roundToQuarter(fatThumbsDay / inputs.mealsPerDay);
  let veggieFistsPerMeal = roundToQuarter(veggieFistsDay / inputs.mealsPerDay);

  // Enforce minimums per meal
  proteinPalmsPerMeal = Math.max(proteinPalmsPerMeal, 0.5);
  veggieFistsPerMeal = Math.max(veggieFistsPerMeal, 0.5);
  carbCupsPerMeal = Math.max(carbCupsPerMeal, 0.25);
  fatThumbsPerMeal = Math.max(fatThumbsPerMeal, 0.25);

  // 9. Calculate goal date
  const totalChangeLb = inputs.goalWeightLb - inputs.currentWeightLb;
  let weeks: number | null = null;
  let targetDate: string | null = null;
  let validDirection = true;

  if (inputs.weeklyChangeLb === 0) {
    // Maintenance - no goal date
    validDirection = true;
  } else {
    // Check if direction matches
    const movingTowardGoal = 
      (totalChangeLb < 0 && inputs.weeklyChangeLb < 0) || // Losing weight, goal is lower
      (totalChangeLb > 0 && inputs.weeklyChangeLb > 0) || // Gaining weight, goal is higher
      totalChangeLb === 0; // Already at goal

    if (!movingTowardGoal && totalChangeLb !== 0) {
      validDirection = false;
    } else if (movingTowardGoal && totalChangeLb !== 0) {
      weeks = Math.ceil(Math.abs(totalChangeLb) / Math.abs(inputs.weeklyChangeLb));
      const today = new Date();
      const targetDateObj = new Date(today);
      targetDateObj.setDate(today.getDate() + weeks * 7);
      targetDate = targetDateObj.toISOString();
    }
  }

  return {
    maintenanceCalories,
    goalCalories,
    weeklyChangeLb: inputs.weeklyChangeLb,
    protein: {
      min: proteinMin,
      max: proteinMax,
      mid: proteinMid,
    },
    carbsGrams: carbGrams,
    fatGrams,
    handPortionsDay: {
      proteinPalms: proteinPalmsDay,
      carbCups: carbCupsDay,
      fatThumbs: fatThumbsDay,
      veggieFists: veggieFistsDay,
    },
    handPortionsPerMeal: {
      proteinPalms: proteinPalmsPerMeal,
      carbCups: carbCupsPerMeal,
      fatThumbs: fatThumbsPerMeal,
      veggieFists: veggieFistsPerMeal,
    },
    timeToGoal: {
      weeks,
      targetDate,
      validDirection,
    },
  };
}

/**
 * Format slider label based on weekly change value
 */
export function getSliderLabel(weeklyChangeLb: number): string {
  if (weeklyChangeLb === 0) {
    return 'Maintain';
  } else if (weeklyChangeLb === -0.25) {
    return 'Slow loss (−0.25 lb/week)';
  } else if (weeklyChangeLb === -0.5) {
    return 'Slow loss (−0.5 lb/week)';
  } else if (weeklyChangeLb === -0.75) {
    return 'Moderate loss (−0.75 lb/week)';
  } else if (weeklyChangeLb === -1.0) {
    return 'Fast loss (−1.0 lb/week)';
  } else if (weeklyChangeLb === -1.5) {
    return 'Fast loss (−1.5 lb/week)';
  } else if (weeklyChangeLb === -2.0) {
    return 'Fast loss (−2.0 lb/week)';
  } else if (weeklyChangeLb === 0.25) {
    return 'Slow gain (+0.25 lb/week)';
  } else if (weeklyChangeLb === 0.5) {
    return 'Slow gain (+0.5 lb/week)';
  } else if (weeklyChangeLb === 0.75) {
    return 'Moderate gain (+0.75 lb/week)';
  } else if (weeklyChangeLb === 1.0) {
    return 'Fast gain (+1.0 lb/week)';
  } else if (weeklyChangeLb === 1.5) {
    return 'Fast gain (+1.5 lb/week)';
  } else if (weeklyChangeLb === 2.0) {
    return 'Fast gain (+2.0 lb/week)';
  }
  // Fallback for any other values
  if (weeklyChangeLb < 0) {
    return `Loss (${weeklyChangeLb.toFixed(2)} lb/week)`;
  } else {
    return `Gain (+${weeklyChangeLb.toFixed(2)} lb/week)`;
  }
}

/**
 * Get slider snap points
 */
export const SLIDER_SNAP_POINTS = [
  -2.0, -1.5, -1.0, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0,
];


