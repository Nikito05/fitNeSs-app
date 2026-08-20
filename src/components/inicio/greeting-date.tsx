'use client'

import { useEffect, useState } from 'react'

export function GreetingDate() {
  const [dateLabel, setDateLabel] = useState<string | null>(null)

  useEffect(() => {
    const formatted = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date())
    // Cálculo intencional en el navegador (no en build/SSR) para que la fecha nunca quede
    // congelada; ver la nota del fix de revisión final ("La fecha del saludo queda congelada
    // en el momento del build").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateLabel(formatted.charAt(0).toUpperCase() + formatted.slice(1))
  }, [])

  if (!dateLabel) return null

  return <p className="text-sm text-muted-foreground">{dateLabel}</p>
}
