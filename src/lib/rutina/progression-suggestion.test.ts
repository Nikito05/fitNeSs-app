import { describe, expect, it } from 'vitest'
import { suggestProgression } from './progression-suggestion'

describe('suggestProgression', () => {
  describe('sin datos', () => {
    it('returns sin_datos when there is no last set', () => {
      expect(suggestProgression('general', null)).toEqual({ action: 'sin_datos' })
    })

    it('returns sin_datos when the last set has no weight (bodyweight exercise)', () => {
      expect(
        suggestProgression('general', {
          actualReps: 10,
          actualWeight: null,
          rpe: 'facil',
          targetReps: 10,
        })
      ).toEqual({ action: 'sin_datos' })
    })
  })

  describe('fuerza', () => {
    it('sube con facil cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 5, actualWeight: 100, rpe: 'facil', targetReps: 5 })
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('sube con justo cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 5, actualWeight: 100, rpe: 'justo', targetReps: 5 })
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('sube con al_limite cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 5, actualWeight: 100, rpe: 'al_limite', targetReps: 5 })
      ).toEqual({ action: 'subir', suggestedWeight: 105 })
    })

    it('baja con al_limite cuando no cumplió el objetivo', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 3, actualWeight: 100, rpe: 'al_limite', targetReps: 5 })
      ).toEqual({ action: 'bajar', suggestedWeight: 95 })
    })

    it('mantiene cuando no cumplió el objetivo pero no fue al_limite', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 3, actualWeight: 100, rpe: 'justo', targetReps: 5 })
      ).toEqual({ action: 'mantener', suggestedWeight: 100 })
    })

    it('nunca baja el peso sugerido debajo de 0', () => {
      expect(
        suggestProgression('fuerza', { actualReps: 3, actualWeight: 3, rpe: 'al_limite', targetReps: 5 })
      ).toEqual({ action: 'bajar', suggestedWeight: 0 })
    })
  })

  describe('hipertrofia', () => {
    it('sube con facil cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('hipertrofia', { actualReps: 12, actualWeight: 40, rpe: 'facil', targetReps: 12 })
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('sube con justo cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('hipertrofia', { actualReps: 12, actualWeight: 40, rpe: 'justo', targetReps: 12 })
      ).toEqual({ action: 'subir', suggestedWeight: 42.5 })
    })

    it('mantiene con al_limite aunque haya cumplido el objetivo', () => {
      expect(
        suggestProgression('hipertrofia', { actualReps: 12, actualWeight: 40, rpe: 'al_limite', targetReps: 12 })
      ).toEqual({ action: 'mantener', suggestedWeight: 40 })
    })

    it('baja con al_limite cuando no cumplió el objetivo', () => {
      expect(
        suggestProgression('hipertrofia', { actualReps: 8, actualWeight: 40, rpe: 'al_limite', targetReps: 12 })
      ).toEqual({ action: 'bajar', suggestedWeight: 37.5 })
    })
  })

  describe('resistencia', () => {
    it('sube solo con facil cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('resistencia', { actualReps: 20, actualWeight: 10, rpe: 'facil', targetReps: 20 })
      ).toEqual({ action: 'subir', suggestedWeight: 11.25 })
    })

    it('mantiene con justo aunque haya cumplido el objetivo', () => {
      expect(
        suggestProgression('resistencia', { actualReps: 20, actualWeight: 10, rpe: 'justo', targetReps: 20 })
      ).toEqual({ action: 'mantener', suggestedWeight: 10 })
    })

    it('mantiene con al_limite aunque haya cumplido el objetivo', () => {
      expect(
        suggestProgression('resistencia', { actualReps: 20, actualWeight: 10, rpe: 'al_limite', targetReps: 20 })
      ).toEqual({ action: 'mantener', suggestedWeight: 10 })
    })

    it('baja con al_limite cuando no cumplió el objetivo', () => {
      expect(
        suggestProgression('resistencia', { actualReps: 15, actualWeight: 10, rpe: 'al_limite', targetReps: 20 })
      ).toEqual({ action: 'bajar', suggestedWeight: 8.75 })
    })
  })

  describe('general', () => {
    it('sube con facil cuando cumplió el objetivo', () => {
      expect(
        suggestProgression('general', { actualReps: 10, actualWeight: 30, rpe: 'facil', targetReps: 10 })
      ).toEqual({ action: 'subir', suggestedWeight: 32.5 })
    })

    it('mantiene con al_limite aunque haya cumplido el objetivo', () => {
      expect(
        suggestProgression('general', { actualReps: 10, actualWeight: 30, rpe: 'al_limite', targetReps: 10 })
      ).toEqual({ action: 'mantener', suggestedWeight: 30 })
    })
  })
})
