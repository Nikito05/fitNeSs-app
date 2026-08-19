'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Button } from '@/components/ui/button'

export function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (barcode: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader()
    let controls: IScannerControls | null = null
    let detected = false
    let cancelled = false

    codeReader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && !detected) {
          detected = true
          controls?.stop()
          onDetected(result.getText())
        }
      })
      .then((startedControls) => {
        if (cancelled) {
          startedControls.stop()
          return
        }
        controls = startedControls
      })
      .catch(() => {
        setError('No pudimos acceder a la cámara. Verificá los permisos.')
      })

    return () => {
      cancelled = true
      controls?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <video ref={videoRef} className="w-full rounded-md" muted playsInline />
      )}
      <Button type="button" variant="outline" onClick={onClose}>
        Cancelar
      </Button>
    </div>
  )
}
