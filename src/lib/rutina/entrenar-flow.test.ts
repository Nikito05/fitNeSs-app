import { describe, expect, it } from 'vitest'
import {
  flattenPlannedSets,
  findFirstUnsavedIndex,
  resolveInitialNote,
  filterSessionsForRoutineDay,
  groupSessionsByRoutineDay,
} from './entrenar-flow'
import { suggestProgressionForExercise } from './progression-suggestion'

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

describe('resolveInitialNote', () => {
  it('usa el comentario de la sesión actual si ya existe una fila guardada, aunque esté vacío', () => {
    expect(resolveInitialNote('', true, 'polea lejos')).toBe('')
  })

  it('usa el comentario de la sesión actual si existe y no está vacío', () => {
    expect(resolveInitialNote('subir', true, 'polea lejos')).toBe('subir')
  })

  it('usa el comentario de la sesión pasada más reciente si no hay fila para la sesión actual', () => {
    expect(resolveInitialNote(undefined, false, 'polea lejos')).toBe('polea lejos')
  })

  it('devuelve vacío si no hay fila actual ni comentario pasado', () => {
    expect(resolveInitialNote(undefined, false, undefined)).toBe('')
    expect(resolveInitialNote(undefined, false, '')).toBe('')
  })

  it('devuelve vacío si el comentario de la sesión pasada es solo espacios y no hay fila actual', () => {
    expect(resolveInitialNote(undefined, false, '   ')).toBe('')
  })
})

describe('filterSessionsForRoutineDay', () => {
  it('devuelve vacío si no hay sesiones', () => {
    expect(filterSessionsForRoutineDay([], 'day-a')).toEqual([])
  })

  it('devuelve vacío si ninguna sesión pertenece al día pedido', () => {
    const sessions = [{ id: 1, routineDayId: 'day-b' }]
    expect(filterSessionsForRoutineDay(sessions, 'day-a')).toEqual([])
  })

  it('filtra sesiones de múltiples días a solo las del día pedido', () => {
    const sessions = [
      { id: 1, routineDayId: 'day-a' },
      { id: 2, routineDayId: 'day-b' },
      { id: 3, routineDayId: 'day-a' },
    ]
    expect(filterSessionsForRoutineDay(sessions, 'day-a')).toEqual([
      { id: 1, routineDayId: 'day-a' },
      { id: 3, routineDayId: 'day-a' },
    ])
  })

  it('excluye sesiones sin día de rutina asociado (routineDayId null)', () => {
    const sessions = [
      { id: 1, routineDayId: 'day-a' },
      { id: 2, routineDayId: null },
    ]
    expect(filterSessionsForRoutineDay(sessions, 'day-a')).toEqual([{ id: 1, routineDayId: 'day-a' }])
  })
})

describe('filterSessionsForRoutineDay + suggestProgressionForExercise: caso reportado por el usuario', () => {
  it('el mismo ejercicio en dos días de rutina distintos calcula sugerencias independientes, sin contaminarse', () => {
    const allSessions = [
      {
        sessionId: 'session-dia-b-reciente',
        routineDayId: 'dia-b',
        sets: [{ setNumber: 1, actualReps: 4, actualWeight: 40, rpe: 'al_limite' as const }],
      },
      {
        sessionId: 'session-dia-a-reciente',
        routineDayId: 'dia-a',
        sets: [{ setNumber: 1, actualReps: 10, actualWeight: 30, rpe: 'facil' as const }],
      },
    ]

    const plannedSets = [{ setNumber: 1, targetReps: 10 }]

    const sugerenciaDiaA = suggestProgressionForExercise(
      'general',
      'mancuernas',
      plannedSets,
      filterSessionsForRoutineDay(allSessions, 'dia-a')
    )
    const sugerenciaDiaB = suggestProgressionForExercise(
      'general',
      'mancuernas',
      plannedSets,
      filterSessionsForRoutineDay(allSessions, 'dia-b')
    )

    // Día A: cumplió el objetivo (10 reps) con RPE fácil — no baja, y con una sola sesión buena
    // (general necesita 2) todavía no sube: mantiene.
    expect(sugerenciaDiaA[1]).toEqual({ action: 'mantener', suggestedWeight: 30 })

    // Día B: no cumplió el objetivo (4 de 10 reps) con RPE al límite — baja, independientemente
    // de lo que pasó en el Día A con el mismo ejercicio.
    expect(sugerenciaDiaB[1]).toEqual({ action: 'bajar', suggestedWeight: 38 })
  })
})

describe('groupSessionsByRoutineDay', () => {
  it('devuelve vacío si no hay sesiones', () => {
    expect(groupSessionsByRoutineDay([])).toEqual([])
  })

  it('agrupa sesiones del mismo día de rutina en un solo grupo', () => {
    const sessions = [
      { sessionId: 's1', routineDayId: 'dia-a', routineDayName: 'Empuje' },
      { sessionId: 's2', routineDayId: 'dia-a', routineDayName: 'Empuje' },
    ]
    expect(groupSessionsByRoutineDay(sessions)).toEqual([
      {
        routineDayId: 'dia-a',
        routineDayName: 'Empuje',
        sessions: [
          { sessionId: 's1', routineDayId: 'dia-a', routineDayName: 'Empuje' },
          { sessionId: 's2', routineDayId: 'dia-a', routineDayName: 'Empuje' },
        ],
      },
    ])
  })

  it('separa sesiones de días de rutina distintos en grupos distintos, preservando el orden de la entrada (más reciente primero)', () => {
    const sessions = [
      { sessionId: 's1', routineDayId: 'dia-b', routineDayName: 'Tirón' },
      { sessionId: 's2', routineDayId: 'dia-a', routineDayName: 'Empuje' },
      { sessionId: 's3', routineDayId: 'dia-b', routineDayName: 'Tirón' },
    ]
    const result = groupSessionsByRoutineDay(sessions)
    expect(result).toHaveLength(2)
    expect(result[0].routineDayId).toBe('dia-b')
    expect(result[0].sessions).toHaveLength(2)
    expect(result[1].routineDayId).toBe('dia-a')
    expect(result[1].sessions).toHaveLength(1)
  })

  it('agrupa sesiones sin día de rutina asociado bajo "Otros registros"', () => {
    const sessions = [{ sessionId: 's1', routineDayId: null, routineDayName: null }]
    expect(groupSessionsByRoutineDay(sessions)).toEqual([
      {
        routineDayId: null,
        routineDayName: 'Otros registros',
        sessions: [{ sessionId: 's1', routineDayId: null, routineDayName: null }],
      },
    ])
  })
})
