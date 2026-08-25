import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The viewfinder.
 *
 * The stream is asked for at the highest resolution the device will give,
 * because every pixel here becomes detail in the finished page — a viewfinder
 * sized for the screen would throw away most of what the sensor can read.
 *
 * There is deliberately no live outline of the page. Detection costs a couple
 * of hundred milliseconds a frame, which would either drop the preview to a
 * stutter or show an outline lagging behind what you are pointing at. The page
 * is found the moment the shutter fires instead, and the corners are yours to
 * move afterwards.
 */
export function Camera({
  onCapture,
  onCancel,
}: {
  onCapture: (bitmap: ImageBitmap) => void
  onCancel: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser has no camera access. Open a photo instead.')
        return
      }
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: {
            // The back camera on a phone; ignored where there is only one.
            facingMode: { ideal: 'environment' },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
          audio: false,
        })
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        stream.current = media
        if (video.current) {
          video.current.srcObject = media
          await video.current.play().catch(() => {})
        }
        setLive(true)
      } catch (e) {
        const name = e instanceof DOMException ? e.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Camera access was refused. Allow it in your browser’s settings, or open a photo instead.'
            : name === 'NotFoundError'
              ? 'No camera was found on this device. Open a photo instead.'
              : 'The camera could not be started. Open a photo instead.',
        )
      }
    }

    void start()
    return () => {
      cancelled = true
      stream.current?.getTracks().forEach((t) => t.stop())
      stream.current = null
    }
  }, [])

  const shoot = useCallback(async () => {
    const el = video.current
    if (!el || !el.videoWidth) return
    setBusy(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = el.videoWidth
      canvas.height = el.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas')
      ctx.drawImage(el, 0, 0)
      const bitmap = await createImageBitmap(canvas)
      canvas.width = 0
      canvas.height = 0
      onCapture(bitmap)
    } catch {
      setError('That frame could not be captured. Try again.')
    } finally {
      setBusy(false)
    }
  }, [onCapture])

  if (error) {
    return (
      <div className="table-plane p-5 sm:p-6">
        <p className="text-[14px] leading-relaxed text-ink">{error}</p>
        <button
          type="button"
          onClick={onCancel}
          className="tap mt-4 inline-flex h-9 items-center rounded-[4px] bg-accent px-4 text-[13.5px] font-semibold text-accent-ink shadow-[var(--lift-1)]"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="table-plane overflow-hidden">
      <div className="relative bg-[rgb(6_8_10)]">
        <video
          ref={video}
          playsInline
          muted
          autoPlay
          className="block max-h-[62dvh] w-full object-contain"
        />

        {/* A frame to aim with. It does not measure anything — it is there so
            the page is held far enough inside the edge to have a border to
            find. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[7%] rounded-[4px] border-2 border-dashed border-white/35"
        />

        {!live && (
          <p className="absolute inset-0 grid place-items-center text-[13.5px] text-white/70">
            Starting the camera…
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 p-4">
        <button
          type="button"
          onClick={onCancel}
          className="tap inline-flex h-10 items-center rounded-[4px] px-3 text-[13.5px] font-semibold text-ink-quiet transition-colors duration-150 hover:text-ink"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => void shoot()}
          disabled={!live || busy}
          aria-label="Take the photo"
          className="tap grid h-16 w-16 place-items-center rounded-full bg-accent shadow-[var(--lift-2)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:-translate-y-px disabled:opacity-40"
        >
          <span aria-hidden="true" className="block h-12 w-12 rounded-full ring-2 ring-inset ring-white/70" />
        </button>

        <span className="w-[4.5rem] text-right text-[12px] leading-tight text-ink-quiet">
          {live ? 'Fill the frame' : ''}
        </span>
      </div>
    </div>
  )
}
