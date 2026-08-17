import { describe, expect, it } from 'vitest'
import {
  calculateAge,
  calculateBMR,
  calculateTDEE,
  calculateCalorieAdjustment,
  calculateMacroTargets,
  calculateDailyGoal,
} from './goal-calculation'

describe('calculateAge', () => {
  it('cumpleaños ya pasado este año', () => {
    expect(calculateAge('1990-03-15', '2026-08-17')).toBe(36)
  })

  it('cumpleaños todavía no llega este año', () => {
    expect(calculateAge('1990-12-25', '2026-08-17')).toBe(35)
  })

  it('cumpleaños es hoy', () => {
    expect(calculateAge('1990-08-17', '2026-08-17')).toBe(36)
  })
})

describe('calculateBMR', () => {
  it('hombre', () => {
    expect(calculateBMR('masculino', 80, 180, 30)).toBeCloseTo(1780, 2)
  })

  it('mujer', () => {
    expect(calculateBMR('femenino', 65, 165, 28)).toBeCloseTo(1380.25, 2)
  })
})

describe('calculateTDEE', () => {
  const bmr = 1780

  it('sedentario', () => {
    expect(calculateTDEE(bmr, 'sedentario')).toBeCloseTo(2136, 2)
  })

  it('ligero', () => {
    expect(calculateTDEE(bmr, 'ligero')).toBeCloseTo(2447.5, 2)
  })

  it('moderado', () => {
    expect(calculateTDEE(bmr, 'moderado')).toBeCloseTo(2759, 2)
  })

  it('intenso', () => {
    expect(calculateTDEE(bmr, 'intenso')).toBeCloseTo(3070.5, 2)
  })

  it('muy_intenso', () => {
    expect(calculateTDEE(bmr, 'muy_intenso')).toBeCloseTo(3382, 2)
  })
})

describe('calculateCalorieAdjustment', () => {
  it('mantener: siempre 0, sin warning, sin importar los demás parámetros', () => {
    expect(calculateCalorieAdjustment('mantener', 80, null, null, '2026-01-01')).toEqual({
      dailyAdjustment: 0,
      warning: null,
    })
  })

  it('bajar sin peso/fecha objetivo: ajuste por defecto, sin warning', () => {
    expect(calculateCalorieAdjustment('bajar', 80, null, null, '2026-01-01')).toEqual({
      dailyAdjustment: -500,
      warning: null,
    })
  })

  it('subir sin peso/fecha objetivo: ajuste por defecto, sin warning', () => {
    expect(calculateCalorieAdjustment('subir', 80, null, null, '2026-01-01')).toEqual({
      dailyAdjustment: 300,
      warning: null,
    })
  })

  it('bajar con peso y fecha objetivo, ritmo razonable: sin warning', () => {
    const result = calculateCalorieAdjustment('bajar', 80, 75, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBeCloseTo(-550, 2)
    expect(result.warning).toBeNull()
  })

  it('subir con peso y fecha objetivo, ritmo razonable: sin warning', () => {
    const result = calculateCalorieAdjustment('subir', 60, 64, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBeCloseTo(440, 2)
    expect(result.warning).toBeNull()
  })

  it('bajar con ritmo que excede el máximo: se cappea, con warning', () => {
    const result = calculateCalorieAdjustment('bajar', 80, 60, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBeCloseTo(-1100, 2)
    expect(result.warning).not.toBeNull()
  })

  it('peso objetivo inconsistente con "bajar" (target más alto que el actual): ajuste por defecto, con warning', () => {
    const result = calculateCalorieAdjustment('bajar', 80, 85, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBe(-500)
    expect(result.warning).not.toBeNull()
  })

  it('peso objetivo inconsistente con "subir" (target más bajo que el actual): ajuste por defecto, con warning', () => {
    const result = calculateCalorieAdjustment('subir', 80, 75, '2026-03-12', '2026-01-01')
    expect(result.dailyAdjustment).toBe(300)
    expect(result.warning).not.toBeNull()
  })

  it('fecha objetivo ya pasada: ajuste por defecto, con warning', () => {
    const result = calculateCalorieAdjustment('bajar', 80, 75, '2026-08-01', '2026-08-17')
    expect(result.dailyAdjustment).toBe(-500)
    expect(result.warning).not.toBeNull()
  })
})

describe('calculateMacroTargets', () => {
  const goalCalories = 2000
  const weightKg = 80

  it('fuerza: 2.2g/kg de proteína', () => {
    const result = calculateMacroTargets(goalCalories, weightKg, 'fuerza')
    expect(result.proteinG).toBeCloseTo(176, 2)
    expect(result.fatG).toBeCloseTo(55.56, 2)
    expect(result.carbsG).toBeCloseTo(199, 2)
  })

  it('hipertrofia: 2.0g/kg de proteína', () => {
    const result = calculateMacroTargets(goalCalories, weightKg, 'hipertrofia')
    expect(result.proteinG).toBeCloseTo(160, 2)
    expect(result.carbsG).toBeCloseTo(215, 2)
  })

  it('resistencia: 1.4g/kg de proteína', () => {
    const result = calculateMacroTargets(goalCalories, weightKg, 'resistencia')
    expect(result.proteinG).toBeCloseTo(112, 2)
    expect(result.carbsG).toBeCloseTo(263, 2)
  })

  it('general: 1.6g/kg de proteína', () => {
    const result = calculateMacroTargets(goalCalories, weightKg, 'general')
    expect(result.proteinG).toBeCloseTo(128, 2)
    expect(result.carbsG).toBeCloseTo(247, 2)
  })

  it('carbohidratos nunca negativos, aunque proteína+grasa superen las calorías totales', () => {
    const result = calculateMacroTargets(1000, 100, 'fuerza')
    expect(result.carbsG).toBe(0)
  })
})

describe('calculateDailyGoal', () => {
  it('respeta el piso del BMR cuando TDEE + ajuste da una meta más baja', () => {
    const result = calculateDailyGoal({
      sex: 'femenino',
      weightKg: 60,
      heightCm: 160,
      birthDate: '1986-01-01',
      activityLevel: 'sedentario',
      weightGoal: 'bajar',
      targetWeightKg: null,
      targetDate: null,
      trainingGoal: 'general',
      today: '2026-08-17',
    })

    // BMR = 10*60 + 6.25*160 - 5*40 - 161 = 1239. TDEE = 1239*1.2 = 1486.8.
    // Ajuste por defecto (bajar, sin objetivo) = -500 → 986.8, por debajo del BMR.
    expect(result.bmr).toBeCloseTo(1239, 2)
    expect(result.goalCalories).toBeCloseTo(1239, 2)
    // Si el piso no se respetara, carbsG saldría bien distinto (calculado sobre 986.8, no 1239).
    expect(result.macros.carbsG).toBeCloseTo(136.31, 2)
    expect(result.warning).toBeNull()
  })

  it('camino feliz: no cappea el piso cuando TDEE + ajuste ya supera el BMR', () => {
    const result = calculateDailyGoal({
      sex: 'masculino',
      weightKg: 80,
      heightCm: 180,
      birthDate: '1996-01-01',
      activityLevel: 'moderado',
      weightGoal: 'mantener',
      targetWeightKg: null,
      targetDate: null,
      trainingGoal: 'fuerza',
      today: '2026-08-17',
    })

    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780. TDEE = 1780*1.55 = 2759.
    // mantener → ajuste 0 → goalCalories = 2759, muy por encima del BMR (piso no se activa).
    expect(result.bmr).toBeCloseTo(1780, 2)
    expect(result.tdee).toBeCloseTo(2759, 2)
    expect(result.goalCalories).toBeCloseTo(2759, 2)
    expect(result.warning).toBeNull()
  })

  it('propaga el warning de calculateCalorieAdjustment hasta el resultado final', () => {
    const result = calculateDailyGoal({
      sex: 'masculino',
      weightKg: 80,
      heightCm: 180,
      birthDate: '1996-01-01',
      activityLevel: 'muy_intenso',
      weightGoal: 'bajar',
      targetWeightKg: 60,
      targetDate: '2026-03-12',
      trainingGoal: 'general',
      today: '2026-01-01',
    })

    // BMR = 1780. TDEE = 1780*1.9 = 3382. Ritmo pedido (80→60kg en 70 días) excede
    // el máximo de 1kg/semana → se cappea a -1100 kcal/día, con warning.
    // goalCalories = 3382 - 1100 = 2282, por encima del BMR (el warning se prueba solo, sin piso de por medio).
    expect(result.goalCalories).toBeCloseTo(2282, 2)
    expect(result.warning).not.toBeNull()
  })
})
