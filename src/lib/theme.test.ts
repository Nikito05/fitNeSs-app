import { describe, expect, it } from 'vitest'
import { isValidTheme, resolveTheme } from './theme'

describe('isValidTheme', () => {
  it('acepta "light"', () => {
    expect(isValidTheme('light')).toBe(true)
  })

  it('acepta "dark"', () => {
    expect(isValidTheme('dark')).toBe(true)
  })

  it('acepta "system"', () => {
    expect(isValidTheme('system')).toBe(true)
  })

  it('rechaza un string arbitrario', () => {
    expect(isValidTheme('blue')).toBe(false)
  })

  it('rechaza null', () => {
    expect(isValidTheme(null)).toBe(false)
  })

  it('rechaza un número', () => {
    expect(isValidTheme(42)).toBe(false)
  })
})

describe('resolveTheme', () => {
  it('"light" siempre da "light", sin importar la preferencia del sistema', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('"dark" siempre da "dark", sin importar la preferencia del sistema', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('"system" da "dark" cuando el sistema prefiere oscuro', () => {
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('"system" da "light" cuando el sistema prefiere claro', () => {
    expect(resolveTheme('system', false)).toBe('light')
  })
})
