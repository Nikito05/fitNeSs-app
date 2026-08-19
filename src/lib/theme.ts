export type Theme = 'light' | 'dark' | 'system'

const VALID_THEMES: Theme[] = ['light', 'dark', 'system']
const STORAGE_KEY = 'fitness-app-theme'

export function isValidTheme(value: unknown): value is Theme {
  return typeof value === 'string' && VALID_THEMES.includes(value as Theme)
}

export function resolveTheme(theme: Theme, systemPrefersDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light'
  return theme
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isValidTheme(stored) ? stored : 'system'
}

export function setStoredTheme(theme: Theme): void {
  window.localStorage.setItem(STORAGE_KEY, theme)
}

export function applyTheme(theme: Theme): void {
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = resolveTheme(theme, systemPrefersDark)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}
