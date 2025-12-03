'use client';

import { DietCalculatorOutput } from '@/app/_lib/diet-calculator';

interface EducationSectionProps {
  perMealPortions: DietCalculatorOutput['handPortionsPerMeal'];
}

export default function EducationSection({ perMealPortions }: EducationSectionProps) {
  const formatHandPortion = (value: number): string => {
    if (value % 1 === 0) {
      return value.toString();
    }
    return value.toFixed(2).replace(/\.?0+$/, '');
  };

  return (
    <div className="space-y-12">
      {/* How to Build Meals */}
      <div>
        <h2 className="text-3xl md:text-4xl font-bold mb-6">How to Build Meals Using Hand Portions</h2>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 md:p-8 space-y-4">
          <p className="text-zinc-300 leading-relaxed">
            Hand portions make portion control simple and portable. No scales, no measuring cups—just your hands.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="font-semibold text-zinc-50 mb-2">1 Palm = Protein</h3>
              <p className="text-zinc-400 text-sm">
                About 25g of protein. Think: chicken breast, fish fillet, lean beef, tofu, eggs.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-50 mb-2">1 Cupped Hand = Carbs</h3>
              <p className="text-zinc-400 text-sm">
                About 25g of carbs. Think: rice, quinoa, sweet potato, oats, fruit.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-50 mb-2">1 Thumb = Fats</h3>
              <p className="text-zinc-400 text-sm">
                About 10g of fat. Think: nuts, avocado, olive oil, nut butter, cheese.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-zinc-50 mb-2">1 Fist = Veggies</h3>
              <p className="text-zinc-400 text-sm">
                Non-starchy vegetables. Think: broccoli, spinach, peppers, zucchini, leafy greens.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Food Lists */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Lean Proteins</h3>
          <ul className="space-y-2 text-zinc-400">
            <li>• Chicken breast</li>
            <li>• Turkey breast</li>
            <li>• Fish (salmon, cod, tuna)</li>
            <li>• Lean beef (93/7 or leaner)</li>
            <li>• Eggs & egg whites</li>
            <li>• Greek yogurt</li>
            <li>• Cottage cheese</li>
            <li>• Tofu & tempeh</li>
            <li>• Protein powder</li>
          </ul>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Vegetables</h3>
          <ul className="space-y-2 text-zinc-400">
            <li>• Broccoli</li>
            <li>• Spinach & leafy greens</li>
            <li>• Bell peppers</li>
            <li>• Zucchini & squash</li>
            <li>• Cauliflower</li>
            <li>• Asparagus</li>
            <li>• Green beans</li>
            <li>• Cucumber</li>
            <li>• Tomatoes</li>
          </ul>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Carbohydrates</h3>
          <ul className="space-y-2 text-zinc-400">
            <li>• Rice (white or brown)</li>
            <li>• Quinoa</li>
            <li>• Sweet potato</li>
            <li>• Oats</li>
            <li>• Whole grain bread</li>
            <li>• Pasta (moderate portions)</li>
            <li>• Fruit (berries, apples, bananas)</li>
            <li>• Legumes (beans, lentils)</li>
          </ul>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Fats</h3>
          <ul className="space-y-2 text-zinc-400">
            <li>• Avocado</li>
            <li>• Nuts (almonds, walnuts)</li>
            <li>• Nut butter</li>
            <li>• Olive oil</li>
            <li>• Coconut oil</li>
            <li>• Cheese (moderate portions)</li>
            <li>• Seeds (chia, flax, pumpkin)</li>
            <li>• Dark chocolate (85%+)</li>
          </ul>
        </div>
      </div>

      {/* Example Plates */}
      <div>
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Example Meals</h2>
        <p className="text-zinc-400 mb-6">
          Here are two example meals built using your per-meal hand portions:
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Example Meal 1 */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4">Example Meal 1</h3>
            <ul className="space-y-3 text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-zinc-500">•</span>
                <span>
                  <strong>{formatHandPortion(perMealPortions.proteinPalms)} palm(s)</strong> grilled chicken breast
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-500">•</span>
                <span>
                  <strong>{formatHandPortion(perMealPortions.carbCups)} cupped hand(s)</strong> brown rice
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-500">•</span>
                <span>
                  <strong>{formatHandPortion(perMealPortions.fatThumbs)} thumb(s)</strong> olive oil drizzled over vegetables
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-500">•</span>
                <span>
                  <strong>{formatHandPortion(perMealPortions.veggieFists)} fist(s)</strong> roasted broccoli and bell peppers
                </span>
              </li>
            </ul>
          </div>

          {/* Example Meal 2 */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-xl font-bold mb-4">Example Meal 2</h3>
            <ul className="space-y-3 text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-zinc-500">•</span>
                <span>
                  <strong>{formatHandPortion(perMealPortions.proteinPalms)} palm(s)</strong> salmon fillet
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-500">•</span>
                <span>
                  <strong>{formatHandPortion(perMealPortions.carbCups)} cupped hand(s)</strong> quinoa
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-500">•</span>
                <span>
                  <strong>{formatHandPortion(perMealPortions.fatThumbs)} thumb(s)</strong> avocado slices
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-zinc-500">•</span>
                <span>
                  <strong>{formatHandPortion(perMealPortions.veggieFists)} fist(s)</strong> mixed greens salad with cucumber
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

