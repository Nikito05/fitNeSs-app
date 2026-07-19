export type FontSize = 'normal' | 'large' | 'xlarge'

const VALID_SIZES: FontSize[] = ['normal', 'large', 'xlarge']
const STORAGE_KEY = 'fitness-app-font-size'

export function isValidFontSize(value: unknown): value is FontSize {
  return typeof value === 'string' && VALID_SIZES.includes(value as FontSize)
}

export function getStoredFontSize(): FontSize {
  if (typeof window === 'undefined') return 'normal'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isValidFontSize(stored) ? stored : 'normal'
}

export function setStoredFontSize(size: FontSize): void {
  window.localStorage.setItem(STORAGE_KEY, size)
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.dataset.fontSize = size
}
