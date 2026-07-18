import { describe, expect, it } from 'vitest'
import { flattenPlannedSets, findFirstUnsavedIndex } from './entrenar-flow'

describe('flattenPlannedSets', () => {
  it('returns an empty array when there are no exercises', () => {
    expect(flattenPlannedSets([])).toEqual([])
  })

  it('flattens a single exercise with multiple sets in order', () => {
    const exercises = [
      {
        exerciseId: 'ex-1',
        exerciseName: 'Press banca',
        plannedSets: [
          { setNumber: 1, targetReps: 10, targetWeight: 50 },
          { setNumber: 2, targetReps: 8, targetWeight: 55 },
        ],
      },
    ]
    expect(flattenPlannedSets(exercises)).toEqual([
      { exerciseId: 'ex-1', exerciseName: 'Press banca', setNumber: 1, targetReps: 10, targetWeight: 50 },
      { exerciseId: 'ex-1', exerciseName: 'Press banca', setNumber: 2, targetReps: 8, targetWeight: 55 },
    ])
  })

  it('concatenates multiple exercises in the given order', () => {
    const exercises = [
      {
        exerciseId: 'ex-1',
        exerciseName: 'Press banca',
        plannedSets: [{ setNumber: 1, targetReps: 10, targetWeight: 50 }],
      },
      {
        exerciseId: 'ex-2',
        exerciseName: 'Sentadilla',
        plannedSets: [{ setNumber: 1, targetReps: 8, targetWeight: null }],
      },
    ]
    const result = flattenPlannedSets(exercises)
    expect(result).toHaveLength(2)
    expect(result[0].exerciseId).toBe('ex-1')
    expect(result[1].exerciseId).toBe('ex-2')
  })
})

describe('findFirstUnsavedIndex', () => {
  const flatSets = [
    { exerciseId: 'ex-1', exerciseName: 'Press banca', setNumber: 1, targetReps: 10, targetWeight: 50 },
    { exerciseId: 'ex-1', exerciseName: 'Press banca', setNumber: 2, targetReps: 8, targetWeight: 55 },
  ]

  it('returns 0 when nothing is saved', () => {
    expect(findFirstUnsavedIndex(flatSets, {})).toBe(0)
  })

  it('returns the index of the first unsaved set', () => {
    expect(findFirstUnsavedIndex(flatSets, { 'ex-1-1': true })).toBe(1)
  })

  it('returns the array length when everything is saved', () => {
    expect(findFirstUnsavedIndex(flatSets, { 'ex-1-1': true, 'ex-1-2': true })).toBe(2)
  })

  it('returns 0 for an empty list of flat sets', () => {
    expect(findFirstUnsavedIndex([], {})).toBe(0)
  })
})
