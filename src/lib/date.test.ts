import { describe, expect, it } from 'vitest'
import { shiftLocalDate } from './date'

describe('shiftLocalDate', () => {
  it('suma un día', () => {
    expect(shiftLocalDate('2026-08-17', 1)).toBe('2026-08-18')
  })

  it('resta un día', () => {
    expect(shiftLocalDate('2026-08-17', -1)).toBe('2026-08-16')
  })

  it('cruza de mes hacia adelante', () => {
    expect(shiftLocalDate('2026-08-31', 1)).toBe('2026-09-01')
  })

  it('cruza de año hacia atrás', () => {
    expect(shiftLocalDate('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('cruza de mes hacia atrás', () => {
    expect(shiftLocalDate('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('respeta año bisiesto', () => {
    expect(shiftLocalDate('2028-02-28', 1)).toBe('2028-02-29')
  })
})
