import { describe, expect, it } from 'vitest'
import {
  scaleToQuantity,
  deriveImpliedPer100g,
  sumDailyTotals,
  calculateRemaining,
  mapOffProductToPer100g,
  extractOffServingGrams,
} from './food-calculation'

describe('scaleToQuantity', () => {
  const per100g = { caloriesPer100g: 80, proteinPer100g: 5, fatPer100g: 2, carbsPer100g: 10 }

  it('100g devuelve las mismas macros que el per100g', () => {
    const result = scaleToQuantity(per100g, 100)
    expect(result.calories).toBeCloseTo(80, 2)
    expect(result.proteinG).toBeCloseTo(5, 2)
    expect(result.fatG).toBeCloseTo(2, 2)
    expect(result.carbsG).toBeCloseTo(10, 2)
  })

  it('escala proporcionalmente a la cantidad', () => {
    const result = scaleToQuantity(per100g, 250)
    expect(result.calories).toBeCloseTo(200, 2)
    expect(result.proteinG).toBeCloseTo(12.5, 2)
    expect(result.fatG).toBeCloseTo(5, 2)
    expect(result.carbsG).toBeCloseTo(25, 2)
  })
})

describe('deriveImpliedPer100g', () => {
  it('es la inversa de scaleToQuantity', () => {
    const macros = { calories: 200, proteinG: 12.5, fatG: 5, carbsG: 25 }
    const result = deriveImpliedPer100g(macros, 250)
    expect(result.caloriesPer100g).toBeCloseTo(80, 2)
    expect(result.proteinPer100g).toBeCloseTo(5, 2)
    expect(result.fatPer100g).toBeCloseTo(2, 2)
    expect(result.carbsPer100g).toBeCloseTo(10, 2)
  })
})

describe('sumDailyTotals', () => {
  it('lista vacía da todo en 0', () => {
    expect(sumDailyTotals([])).toEqual({ calories: 0, proteinG: 0, fatG: 0, carbsG: 0 })
  })

  it('un solo registro devuelve ese mismo registro', () => {
    const entry = { calories: 100, proteinG: 10, fatG: 5, carbsG: 15 }
    expect(sumDailyTotals([entry])).toEqual(entry)
  })

  it('suma varios registros', () => {
    const entries = [
      { calories: 100, proteinG: 10, fatG: 5, carbsG: 15 },
      { calories: 250, proteinG: 20, fatG: 8, carbsG: 30 },
    ]
    expect(sumDailyTotals(entries)).toEqual({ calories: 350, proteinG: 30, fatG: 13, carbsG: 45 })
  })
})

describe('calculateRemaining', () => {
  it('consumido por debajo de la meta: resultado positivo', () => {
    const goal = { calories: 2282, proteinG: 150, fatG: 60, carbsG: 200 }
    const consumed = { calories: 1500, proteinG: 100, fatG: 40, carbsG: 150 }
    expect(calculateRemaining(goal, consumed)).toEqual({ calories: 782, proteinG: 50, fatG: 20, carbsG: 50 })
  })

  it('consumido por encima de la meta: resultado negativo', () => {
    const goal = { calories: 2000, proteinG: 150, fatG: 60, carbsG: 200 }
    const consumed = { calories: 2200, proteinG: 160, fatG: 70, carbsG: 210 }
    expect(calculateRemaining(goal, consumed)).toEqual({ calories: -200, proteinG: -10, fatG: -10, carbsG: -10 })
  })
})

describe('mapOffProductToPer100g', () => {
  it('producto con los 4 valores completos', () => {
    const product = {
      code: '123',
      productName: 'Yogur natural',
      nutriments: {
        'energy-kcal_100g': 61,
        proteins_100g: 3.5,
        fat_100g: 3.2,
        carbohydrates_100g: 4.7,
      },
      servingQuantity: 125,
    }
    expect(mapOffProductToPer100g(product)).toEqual({
      caloriesPer100g: 61,
      proteinPer100g: 3.5,
      fatPer100g: 3.2,
      carbsPer100g: 4.7,
    })
  })

  it('producto al que le falta un valor nutricional: null', () => {
    const product = {
      code: '456',
      productName: 'Producto incompleto',
      nutriments: {
        'energy-kcal_100g': 200,
        proteins_100g: 5,
        // falta fat_100g
        carbohydrates_100g: 20,
      },
      servingQuantity: null,
    }
    expect(mapOffProductToPer100g(product)).toBeNull()
  })
})

describe('extractOffServingGrams', () => {
  it('servingQuantity numérico positivo: lo devuelve', () => {
    const product = {
      code: '123',
      productName: 'X',
      nutriments: {},
      servingQuantity: 125,
    }
    expect(extractOffServingGrams(product)).toBe(125)
  })

  it('servingQuantity null: devuelve null', () => {
    const product = { code: '123', productName: 'X', nutriments: {}, servingQuantity: null }
    expect(extractOffServingGrams(product)).toBeNull()
  })

  it('servingQuantity 0 (no positivo): devuelve null', () => {
    const product = { code: '123', productName: 'X', nutriments: {}, servingQuantity: 0 }
    expect(extractOffServingGrams(product)).toBeNull()
  })
})
