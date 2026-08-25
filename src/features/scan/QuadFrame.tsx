import { useRef } from 'react'
import type { Point, Quad } from '../../lib/scan/detect'

/**
 * The four corners of the page, over the photograph.
 *
 * Free corners rather than a rectangle: a page photographed at an angle is a
 * quadrilateral, and forcing it back into a rectangle here would throw away
 * the very information the perspective correction needs.
 *
 * Corners work in the photograph's own pixels and are divided by the display
 * scale only at the edges, so what is framed on a phone is the same shape as
 * what would be framed on a desktop.
 */
export function QuadFrame({
  quad,
  bounds,
  scale,
  onChange,
}: {
  quad: Quad
  /** The photograph's size, in its own pixels. */
  bounds: { width: number; height: number }
  /** Display pixels per source pixel. */
  scale: number
  onChange: (next: Quad) => void
}) {
  const drag = useRef<{ index: number; startX: number; startY: number; from: Point } | null>(null)

  const begin = (e: React.PointerEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    drag.current = { index, startX: e.clientX, startY: e.clientY, from: { ...quad[index] } }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* the pointer went away before we could claim it */
    }
  }

  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const next = [...quad] as Quad
    next[d.index] = {
      x: Math.min(bounds.width, Math.max(0, d.from.x + (e.clientX - d.startX) / scale)),
      y: Math.min(bounds.height, Math.max(0, d.from.y + (e.clientY - d.startY) / scale)),
    }
    onChange(next)
  }

  const end = () => {
    drag.current = null
  }

  const px = (n: number) => n * scale
  const points = quad.map((p) => `${px(p.x)},${px(p.y)}`).join(' ')
  const w = px(bounds.width)
  const h = px(bounds.height)
  const names = ['top left', 'top right', 'bottom right', 'bottom left']

  return (
    <div
      className="absolute inset-0"
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{ touchAction: 'none' }}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${w} ${h}`}
        aria-hidden="true"
      >
        {/* Everything outside the page goes dim, so the frame reads as the
            document and the rest as the table it is lying on. */}
        <defs>
          <mask id="page-mask">
            <rect x="0" y="0" width={w} height={h} fill="white" />
            <polygon points={points} fill="black" />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={w}
          height={h}
          fill="rgb(6 8 10 / 0.58)"
          mask="url(#page-mask)"
        />
        <polygon
          points={points}
          fill="none"
          stroke="rgb(255 255 255 / 0.95)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      {quad.map((p, i) => (
        <span
          key={names[i]}
          role="button"
          tabIndex={0}
          aria-label={`Move the ${names[i]} corner`}
          onPointerDown={(e) => begin(e, i)}
          className="absolute grid place-items-center"
          style={{
            left: px(p.x),
            top: px(p.y),
            // The grab area is deliberately bigger than the mark it draws: a
            // 16px dot is easy to see and impossible to catch with a thumb.
            width: 44,
            height: 44,
            transform: 'translate(-50%, -50%)',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <span
            aria-hidden="true"
            className="block h-4 w-4 rounded-full bg-white shadow-[0_0_0_2px_rgb(6_8_10/0.55)]"
          />
        </span>
      ))}
    </div>
  )
}
