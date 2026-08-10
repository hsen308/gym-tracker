import { useEffect, useRef, useState } from 'react'
import Button from '../../components/Button'
import Icon from '../../components/Icon'

// Camera barcode scanning.
//
// Two decoders, because neither covers everything:
//   BarcodeDetector  native, fast, zero download — Chrome and Android
//   ZXing            a ~300 KB library, lazy-loaded — everything else,
//                    which importantly includes iOS Safari, where
//                    BarcodeDetector still doesn't exist
//
// Typing the number is always available as a fallback. Gym lighting, a
// crumpled wrapper or a denied camera permission all end the same way, and a
// scanner with no manual escape hatch is a dead end.
export default function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null)
  const stopRef = useRef(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let cancelled = false

    const handle = (code) => {
      if (cancelled || !code) return
      cancelled = true
      navigator.vibrate?.(60) // confirms the read without needing to look
      stopRef.current?.()
      onDetected(code)
    }

    const start = async () => {
      try {
        // facingMode 'environment' asks for the rear camera; without it
        // phones default to the selfie camera, pointed at your face.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())

        const video = videoRef.current
        if (!video) return stream.getTracks().forEach((t) => t.stop())
        video.srcObject = stream
        // Required on iOS: without playsInline the video takes over the
        // whole screen in a native player and the scanner UI disappears.
        video.setAttribute('playsinline', 'true')
        await video.play()
        setStarting(false)

        stopRef.current = () => stream.getTracks().forEach((t) => t.stop())

        if ('BarcodeDetector' in window) {
          const detector = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
          })
          const tick = async () => {
            if (cancelled) return
            try {
              const found = await detector.detect(video)
              if (found?.length) return handle(found[0].rawValue)
            } catch { /* a dropped frame is not worth reporting */ }
            requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
          return
        }

        // Lazy: nothing downloads this until someone actually opens the
        // scanner, so the logging path never pays for it.
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (cancelled) return
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          if (result) handle(result.getText())
        })
        const stopStream = stopRef.current
        stopRef.current = () => { controls.stop(); stopStream?.() }
      } catch (err) {
        if (cancelled) return
        setStarting(false)
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was denied. Type the barcode instead.'
            : 'Could not start the camera. Type the barcode instead.',
        )
      }
    }

    start()
    return () => { cancelled = true; stopRef.current?.() }
  }, [onDetected])

  return (
    <div className="scanner">
      <div className="scanner-frame">
        <video ref={videoRef} className="scanner-video" muted playsInline />
        {/* A window rather than instructions: people line a barcode up with
            a box without being told to. */}
        <div className="scanner-reticle" />
        {starting && !error && <p className="scanner-status">Starting camera…</p>}
      </div>

      {error && <p className="form-error" style={{ marginTop: 0 }}>{error}</p>}

      <label className="field" style={{ marginTop: 'var(--space-4)' }}>
        <span className="label">Or type the barcode</span>
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          placeholder="5000112637922"
        />
      </label>

      <div className="set-editor-actions" style={{ marginTop: 'var(--space-4)' }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button className="btn-block" disabled={manual.length < 6} onClick={() => onDetected(manual)}>
          <Icon name="check" size={18} /> Look up
        </Button>
      </div>
    </div>
  )
}
