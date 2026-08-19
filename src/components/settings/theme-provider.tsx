'use client'

import { useEffect } from 'react'
import { applyTheme, getStoredTheme } from '@/lib/theme'

export function ThemeProvider() {
  useEffect(() => {
    applyTheme(getStoredTheme())

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function handleChange() {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  return null
}
