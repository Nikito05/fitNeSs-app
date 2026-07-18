import { describe, expect, it } from 'vitest'
import { calculateSessionVolume, buildProgressionSeries } from './progression'

describe('calculateSessionVolume', () => {
  it('returns 0 for an empty list of sets', () => {
    expect(calculateSessionVolume([])).toBe(0)
  })

  it('multiplies reps by weight for a single set', () => {
    expect(calculateSessionVolume([{ actualReps: 10, actualWeight: 50 }])).toBe(500)
  })

  it('treats a null weight as 0 (bodyweight exercises)', () => {
    expect(calculateSessionVolume([{ actualReps: 12, actualWeight: null }])).toBe(0)
  })

  it('sums volume across multiple sets', () => {
    const sets = [
      { actualReps: 10, actualWeight: 50 },
      { actualReps: 8, actualWeight: 55 },
    ]
    expect(calculateSessionVolume(sets)).toBe(940)
  })
})

describe('buildProgressionSeries', () => {
  it('returns an empty array for no sessions', () => {
    expect(buildProgressionSeries([])).toEqual([])
  })

  it('computes volume per session', () => {
    const sessions = [
      { sessionDate: '2026-07-01', sets: [{ actualReps: 10, actualWeight: 50 }] },
    ]
    expect(buildProgressionSeries(sessions)).toEqual([{ date: '2026-07-01', volume: 500 }])
  })

  it('sorts sessions chronologically ascending regardless of input order', () => {
    const sessions = [
      { sessionDate: '2026-07-10', sets: [{ actualReps: 10, actualWeight: 50 }] },
      { sessionDate: '2026-07-01', sets: [{ actualReps: 10, actualWeight: 40 }] },
    ]
    const result = buildProgressionSeries(sessions)
    expect(result.map((point) => point.date)).toEqual(['2026-07-01', '2026-07-10'])
  })
})
