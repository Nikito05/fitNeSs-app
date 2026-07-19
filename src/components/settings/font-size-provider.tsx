'use client'

import { useEffect } from 'react'
import { applyFontSize, getStoredFontSize } from '@/lib/font-size'

export function FontSizeProvider() {
  useEffect(() => {
    applyFontSize(getStoredFontSize())
  }, [])

  return null
}
