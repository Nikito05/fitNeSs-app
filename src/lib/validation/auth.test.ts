import { describe, expect, it } from 'vitest'
import { isValidEmail, passwordsMatch } from './auth'

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })

  it('rejects a string without an @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects a string without a domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })
})

describe('passwordsMatch', () => {
  it('returns true when both passwords are identical and non-empty', () => {
    expect(passwordsMatch('hunter2', 'hunter2')).toBe(true)
  })

  it('returns false when passwords differ', () => {
    expect(passwordsMatch('hunter2', 'hunter3')).toBe(false)
  })

  it('returns false when both are empty', () => {
    expect(passwordsMatch('', '')).toBe(false)
  })
})
