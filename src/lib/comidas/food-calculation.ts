export type MacroAmounts = {
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
}

export type MacroAmountsPer100g = {
  caloriesPer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbsPer100g: number
}

export type OffProduct = {
  code: string
  productName: string | null
  nutriments: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    fat_100g?: number
    carbohydrates_100g?: number
  }
  servingQuantity: number | null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function scaleToQuantity(per100g: MacroAmountsPer100g, quantityG: number): MacroAmounts {
  const factor = quantityG / 100
  return {
    calories: round2(per100g.caloriesPer100g * factor),
    proteinG: round2(per100g.proteinPer100g * factor),
    fatG: round2(per100g.fatPer100g * factor),
    carbsG: round2(per100g.carbsPer100g * factor),
  }
}

export function deriveImpliedPer100g(macros: MacroAmounts, quantityG: number): MacroAmountsPer100g {
  const factor = 100 / quantityG
  return {
    caloriesPer100g: round2(macros.calories * factor),
    proteinPer100g: round2(macros.proteinG * factor),
    fatPer100g: round2(macros.fatG * factor),
    carbsPer100g: round2(macros.carbsG * factor),
  }
}

export function sumDailyTotals(entries: MacroAmounts[]): MacroAmounts {
  return entries.reduce(
    (total, entry) => ({
      calories: total.calories + entry.calories,
      proteinG: total.proteinG + entry.proteinG,
      fatG: total.fatG + entry.fatG,
      carbsG: total.carbsG + entry.carbsG,
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 }
  )
}

export function calculateRemaining(goal: MacroAmounts, consumed: MacroAmounts): MacroAmounts {
  return {
    calories: goal.calories - consumed.calories,
    proteinG: goal.proteinG - consumed.proteinG,
    fatG: goal.fatG - consumed.fatG,
    carbsG: goal.carbsG - consumed.carbsG,
  }
}

export function mapOffProductToPer100g(product: OffProduct): MacroAmountsPer100g | null {
  const {
    'energy-kcal_100g': calories,
    proteins_100g: protein,
    fat_100g: fat,
    carbohydrates_100g: carbs,
  } = product.nutriments

  if (calories == null || protein == null || fat == null || carbs == null) return null

  return {
    caloriesPer100g: calories,
    proteinPer100g: protein,
    fatPer100g: fat,
    carbsPer100g: carbs,
  }
}

export function extractOffServingGrams(product: OffProduct): number | null {
  return product.servingQuantity != null && product.servingQuantity > 0 ? product.servingQuantity : null
}

export type MacroProgress = {
  percent: number
  isComplete: boolean
  excess: number
}

export function calculateMacroProgress(consumedValue: number, goalValue: number): MacroProgress {
  if (goalValue <= 0) {
    return { percent: consumedValue > 0 ? 100 : 0, isComplete: consumedValue > 0, excess: 0 }
  }

  const rawPercent = (consumedValue / goalValue) * 100

  return {
    percent: Math.min(100, Math.max(0, rawPercent)),
    isComplete: consumedValue >= goalValue,
    excess: Math.max(0, consumedValue - goalValue),
  }
}
