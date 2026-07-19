import { describe, expect, it } from 'vitest'
import { suggestProgression, suggestProgressionForExercise } from './progression-suggestion'

describe('suggestProgression', () => {
  describe('sin datos', () => {
    it('sin historial', () => {
      expect(suggestProgression('general', 'barra', 10, [])).toEqual({ action: 'sin_datos' })
    })

    it('la sesión más reciente no tiene peso registrado', () => {
      expect(
        suggestProgression('general', 'barra', 10, [
          { actualReps: 10, actualWeight: null, rpe: 'facil' },
        ])
      ).toEqual({ action: 'sin_datos' })
    })

    it('peso corporal nunca sugiere, aunque haya peso registrado (ej. dominadas lastradas)', () => {
      expect(
        suggestProgression('fuerza', 'peso_corporal', 10, [
          { actualReps: 10, actualWeight: 80, rpe: 'facil' },
        ])
      ).toEqual({ action: 'sin_datos' })
    })
  })

  describe('bajar', () => {
    it('baja con una sola sesión: no cumplió objetivo y RPE al límite', () => {
      expect(
        suggestProgression('general', 'barra', 8, [
          { actualReps: 5, actualWeight: 60, rpe: 'al_limite' },
        ])
      ).toEqual({ action: 'bajar', suggestedWeight: 55 })
    })

    it('nunca baja el peso sugerido debajo de 0', () => {
      expect(
        suggestProgression('general', 'mancuernas', 8, [
          { actualReps: 5, actualWeight: 1, rpe: 'al_limite' },
        ])
      ).toEqual({ action: 'bajar', suggestedWeight: 0 })
    })
  })

  describe('mantener', () => {
    it('no cumplió objetivo pero el RPE no fue al límite: mantiene', () => {
      expect(
        suggestProgression('general', 'barra', 8, [
          { actualReps: 5, actualWeight: 60, rpe: 'justo' },
        ])
      ).toEqual({ action: 'mantener', suggestedWeight: 60 })
    })

    it('hipertrofia con una sola sesión buena (necesita 2): mantiene', () => {
      expect(
        suggestProgression('hipertrofia', 'maquina', 10, [
          { actualReps: 10, actualWeight: 40, rpe: 'facil' },
        ])
      ).toEqual({ action: 'mantener', suggestedWeight: 40 })
    })

    it('resistencia con 2 sesiones buenas (necesita 3): mantiene', () => {
      expect(
        suggestProgression('resistencia', 'mancuernas', 12, [
          { actualReps: 12, actualWeight: 10, rpe: 'facil' },
          { actualReps: 12, actualWeight: 10, rpe: 'facil' },
        ])
      ).toEqual({ action: 'mantener', suggestedWeight: 10 })
    })
  })

  describe('subir por frecuencia', () => {
    it('fuerza sube con una sola sesión buena', () => {
      expect(
        suggestProgression('fuerza', 'barra', 5, [
          { actualReps: 5, actualWeight: 100, rpe: 'justo' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('hipertrofia sube al completar 2 sesiones buenas seguidas', () => {
      expect(
        suggestProgression('hipertrofia', 'maquina', 10, [
          { actualReps: 10, actualWeight: 40, rpe: 'facil' },
          { actualReps: 10, actualWeight: 40, rpe: 'justo' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('resistencia sube al completar 3 sesiones buenas', () => {
      expect(
        suggestProgression('resistencia', 'mancuernas', 12, [
          { actualReps: 12, actualWeight: 10, rpe: 'facil' },
          { actualReps: 12, actualWeight: 10, rpe: 'facil' },
          { actualReps: 12, actualWeight: 10, rpe: 'justo' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 12 })
    })

    it('general sube al completar 2 sesiones buenas', () => {
      expect(
        suggestProgression('general', 'maquina', 10, [
          { actualReps: 10, actualWeight: 30, rpe: 'facil' },
          { actualReps: 10, actualWeight: 30, rpe: 'facil' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 32.5 })
    })

    it('una sesión que no califica en el medio de la racha no resetea el conteo', () => {
      // Sesión más reciente: buena. Sesión del medio: no cumplió objetivo (se saltea).
      // Sesión más antigua: buena. Hipertrofia necesita 2 — se alcanzan igual.
      expect(
        suggestProgression('hipertrofia', 'maquina', 10, [
          { actualReps: 10, actualWeight: 40, rpe: 'facil' },
          { actualReps: 5, actualWeight: 40, rpe: 'justo' },
          { actualReps: 10, actualWeight: 38, rpe: 'facil' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('el peso base para subir es siempre el de la sesión más reciente, no el de la sesión que completó la racha', () => {
      expect(
        suggestProgression('hipertrofia', 'barra', 5, [
          { actualReps: 5, actualWeight: 100, rpe: 'facil' },
          { actualReps: 5, actualWeight: 90, rpe: 'facil' },
        ])
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })
  })

  describe('incrementos por equipamiento', () => {
    it('barra: +5kg', () => {
      expect(
        suggestProgression('fuerza', 'barra', 5, [{ actualReps: 5, actualWeight: 100, rpe: 'facil' }])
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('mancuernas: +2kg', () => {
      expect(
        suggestProgression('fuerza', 'mancuernas', 10, [{ actualReps: 10, actualWeight: 20, rpe: 'facil' }])
      ).toEqual({ action: 'subir', suggestedWeight: 22 })
    })

    it('maquina: +2.5kg', () => {
      expect(
        suggestProgression('fuerza', 'maquina', 10, [{ actualReps: 10, actualWeight: 40, rpe: 'facil' }])
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('polea: +2.5kg (igual que máquina)', () => {
      expect(
        suggestProgression('fuerza', 'polea', 10, [{ actualReps: 10, actualWeight: 15, rpe: 'facil' }])
      ).toEqual({ action: 'subir', suggestedWeight: 17.5 })
    })
  })
})

describe('suggestProgressionForExercise', () => {
  it('calcula una sugerencia independiente por cada número de serie', () => {
    const plannedSets = [
      { setNumber: 1, targetReps: 10 },
      { setNumber: 2, targetReps: 10 },
    ]
    const pastSessions = [
      {
        sets: [
          { setNumber: 1, actualReps: 10, actualWeight: 45, rpe: 'facil' as const },
          { setNumber: 2, actualReps: 10, actualWeight: 35, rpe: 'facil' as const },
        ],
      },
    ]

    const result = suggestProgressionForExercise('fuerza', 'barra', plannedSets, pastSessions)

    expect(result[1]).toEqual({ action: 'subir', suggestedWeight: 50 })
    expect(result[2]).toEqual({ action: 'subir', suggestedWeight: 40 })
  })

  it('omite la serie que no tiene ningún historial previo', () => {
    const plannedSets = [
      { setNumber: 1, targetReps: 10 },
      { setNumber: 2, targetReps: 10 },
    ]
    const pastSessions = [
      { sets: [{ setNumber: 1, actualReps: 10, actualWeight: 45, rpe: 'facil' as const }] },
    ]

    const result = suggestProgressionForExercise('fuerza', 'barra', plannedSets, pastSessions)

    expect(result[1]).toEqual({ action: 'subir', suggestedWeight: 50 })
    expect(result[2]).toBeUndefined()
  })

  it('devuelve un objeto vacío cuando no hay sesiones pasadas', () => {
    const plannedSets = [{ setNumber: 1, targetReps: 10 }]

    expect(suggestProgressionForExercise('fuerza', 'barra', plannedSets, [])).toEqual({})
  })
})
