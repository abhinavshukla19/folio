import { useRef } from 'react'
import { clampCrop } from '../../lib/image/edit'

type Rect = { x: number; y: number; w: number; h: number }

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'

/** Which edges a handle drags. `move` slides the whole rectangle. */
const PULLS: Record<Exclude<Handle, 'move'>, { l: boolean; r: boolean; t: boolean; b: boolean }> = {
  nw: { l: true, r: false, t: true, b: false },
  n: { l: false, r: false, t: true, b: false },
  ne: { l: false, r: true, t: true, b: false },
  e: { l: false, r: true, t: false, b: false },
  se: { l: false, r: true, t: false, b: true },
  s: { l: false, r: false, t: false, b: true },
  sw: { l: true, r: false, t: false, b: true },
  w: { l: true, r: false, t: false, b: false },
}

const CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  move: 'move',
}

/**
 * The crop rectangle, drawn over the photo.
 *
 * It works in the source image's own pixels and only divides by the display
 * scale at the edges, so a crop is exact no matter how small the preview is
 * on screen — what you frame on a phone is the same rectangle you would frame
 * on a desktop.
 */
export function CropFrame({
  crop,
  bounds,
  scale,
  ratio,
  onChange,
}: {
  crop: Rect
  /** The oriented image size, in source pixels. */
  bounds: { width: number; height: number }
  /** Display pixels per source pixel. */
  scale: number
  ratio?: number
  onChange: (next: Rect) => void
}) {
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: Rect } | null>(null)

  const begin = (e: React.PointerEvent, handle: Handle) => {
    e.preventDefault()
    e.stopPropagation()
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...crop } }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* the pointer went away before we could claim it */
    }
  }

  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.startX) / scale
    const dy = (e.clientY - d.startY) / scale

    if (d.handle === 'move') {
      onChange(
        clampCrop({ ...d.start, x: d.start.x + dx, y: d.start.y + dy }, bounds, undefined),
      )
      return
    }

    const pull = PULLS[d.handle]
    let { x, y, w, h } = d.start

    if (pull.l) {
      x = d.start.x + dx
      w = d.start.w - dx
    }
    if (pull.r) w = d.start.w + dx
    if (pull.t) {
      y = d.start.y + dy
      h = d.start.h - dy
    }
    if (pull.b) h = d.start.h + dy

    // A drag past the opposite edge would invert the box; stop it at nothing
    // rather than letting it turn inside out.
    if (w < 16) {
      if (pull.l) x = d.start.x + d.start.w - 16
      w = 16
    }
    if (h < 16) {
      if (pull.t) y = d.start.y + d.start.h - 16
      h = 16
    }

    const next = clampCrop({ x, y, w, h }, bounds, ratio)
    // With a locked ratio the box is resized from the corner being held, so
    // anchor whichever edges are not moving.
    if (ratio) {
      if (pull.r) next.x = Math.min(d.start.x, bounds.width - next.w)
      if (pull.b) next.y = Math.min(d.start.y, bounds.height - next.h)
      if (pull.l) next.x = Math.max(0, d.start.x + d.start.w - next.w)
      if (pull.t) next.y = Math.max(0, d.start.y + d.start.h - next.h)
    }
    onChange(next)
  }

  const end = () => {
    drag.current = null
  }

  const px = (n: number) => `${n * scale}px`
  const handles: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

  return (
    <div
      className="absolute inset-0"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{ touchAction: 'none' }}
    >
      {/* Everything outside the crop goes dim, so the frame reads as the
          picture and the rest as offcut. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'rgb(6 8 10 / 0.55)',
          clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0,
            ${px(crop.x)} ${px(crop.y)},
            ${px(crop.x)} ${px(crop.y + crop.h)},
            ${px(crop.x + crop.w)} ${px(crop.y + crop.h)},
            ${px(crop.x + crop.w)} ${px(crop.y)},
            ${px(crop.x)} ${px(crop.y)})`,
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Move the crop"
        onPointerDown={(e) => begin(e, 'move')}
        className="absolute outline-none"
        style={{
          left: px(crop.x),
          top: px(crop.y),
          width: px(crop.w),
          height: px(crop.h),
          cursor: CURSORS.move,
          boxShadow: '0 0 0 1px rgb(255 255 255 / 0.9), 0 0 0 2px rgb(6 8 10 / 0.45)',
        }}
      >
        {/* Thirds, the way a viewfinder shows them. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          {[1, 2].map((i) => (
            <span
              key={`v${i}`}
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${(i * 100) / 3}%`, background: 'rgb(255 255 255 / 0.35)' }}
            />
          ))}
          {[1, 2].map((i) => (
            <span
              key={`h${i}`}
              className="absolute left-0 right-0 h-px"
              style={{ top: `${(i * 100) / 3}%`, background: 'rgb(255 255 255 / 0.35)' }}
            />
          ))}
        </span>

        {handles.map((h) => {
          const corner = h.length === 2
          const left = h.includes('w') ? '0%' : h.includes('e') ? '100%' : '50%'
          const top = h.includes('n') ? '0%' : h.includes('s') ? '100%' : '50%'
          return (
            <span
              key={h}
              role="button"
              tabIndex={-1}
              aria-label={`Resize from ${h}`}
              onPointerDown={(e) => begin(e, h)}
              className="absolute rounded-[2px] bg-white shadow-[0_0_0_1px_rgb(6_8_10/0.5)]"
              style={{
                left,
                top,
                width: corner ? 14 : 22,
                height: corner ? 14 : 22,
                transform: 'translate(-50%, -50%)',
                cursor: CURSORS[h],
                touchAction: 'none',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
