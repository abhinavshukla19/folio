import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from './ui'

/**
 * Draw a signature with a mouse, pen or finger. Exports a transparent PNG
 * trimmed to the ink, so it drops onto a page without a white block behind it.
 */
export function SignaturePad({
  onDone,
  onCancel,
}: {
  onDone: (dataUrl: string, aspect: number) => void
  onCancel: () => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [colour, setColour] = useState('#0a0a0a')
  const [weight, setWeight] = useState(3)

  // Back the canvas at device resolution so the stroke is not soft.
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 3)
    const rect = c.getBoundingClientRect()
    c.width = Math.round(rect.width * dpr)
    c.height = Math.round(rect.height * dpr)
    const ctx = c.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [])

  const pointAt = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    canvas.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pointAt(e)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || !last.current) return
    const p = pointAt(e)
    ctx.strokeStyle = colour
    ctx.lineWidth = weight
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (!dirty) setDirty(true)
  }

  const end = () => {
    drawing.current = false
    last.current = null
  }

  const clear = useCallback(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height)
    setDirty(false)
  }, [])

  /** Crops to the drawn ink so the placed signature has no dead margin. */
  const commit = useCallback(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return

    const { width, height } = c
    const data = ctx.getImageData(0, 0, width, height).data
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return // nothing drawn

    const pad = 6
    minX = Math.max(0, minX - pad)
    minY = Math.max(0, minY - pad)
    maxX = Math.min(width - 1, maxX + pad)
    maxY = Math.min(height - 1, maxY + pad)

    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const crop = document.createElement('canvas')
    crop.width = w
    crop.height = h
    crop.getContext('2d')?.drawImage(c, minX, minY, w, h, 0, 0, w, h)
    onDone(crop.toDataURL('image/png'), w / h)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgb(6_8_10/0.62)] p-3 sm:p-5">
      <div className="table-plane flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden sm:max-h-[calc(100dvh-2.5rem)]">
        <div className="shrink-0 border-b border-edge px-5 py-3 sm:py-4">
          <h2 className="display text-[18px]">Draw your signature</h2>
          <p className="mt-1 text-[13.5px] text-ink-quiet">
            Use a mouse, pen or finger. It is cropped to the ink and stays on your device.
          </p>
        </div>

        <canvas
          ref={canvas}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-[clamp(112px,26dvh,208px)] w-full shrink-0 touch-none bg-sheet"
          style={{ cursor: 'crosshair' }}
        />

        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-edge px-5 py-2.5 sm:py-3">
          <label className="flex items-center gap-2 text-[13px] text-ink-quiet">
            Ink
            <input
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded-[4px] border border-edge bg-transparent"
              aria-label="Ink colour"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-quiet">
            Weight
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="w-28 cursor-pointer"
              aria-label="Stroke weight"
            />
          </label>
          <button
            type="button"
            onClick={clear}
            className="tap ml-auto inline-flex items-center rounded-[4px] px-2 text-[13px] font-semibold text-ink-quiet transition-colors duration-200 hover:text-stop"
          >
            Clear
          </button>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-edge px-5 py-3 sm:py-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="solid" onClick={commit} disabled={!dirty}>
            Place signature
          </Button>
        </div>
      </div>
    </div>
  )
}
