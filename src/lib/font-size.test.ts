import { describe, expect, it } from 'vitest'
import { isValidFontSize } from './font-size'

describe('isValidFontSize', () => {
  it('accepts "normal"', () => {
    expect(isValidFontSize('normal')).toBe(true)
  })

  it('accepts "large"', () => {
    expect(isValidFontSize('large')).toBe(true)
  })

  it('accepts "xlarge"', () => {
    expect(isValidFontSize('xlarge')).toBe(true)
  })

  it('rejects an arbitrary string', () => {
    expect(isValidFontSize('huge')).toBe(false)
  })

  it('rejects null', () => {
    expect(isValidFontSize(null)).toBe(false)
  })

  it('rejects a number', () => {
    expect(isValidFontSize(42)).toBe(false)
  })
})
