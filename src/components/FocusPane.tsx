import type { ReactNode } from 'react'

/**
 * The large view of whatever you are currently working on. It sits beside the
 * grid so a change you make to one page is visible at a size worth looking at,
 * without losing sight of the document as a whole.
 */
export function FocusPane({
  label,
  caption,
  src,
  rotation = 0,
  aspect = 1 / 1.414,
  actions,
  emptyHint,
  overlay,
}: {
  label: string
  caption?: string
  src?: string
  rotation?: number
  /** width / height of the source, so a rotated page still fits its box. */
  aspect?: number
  actions?: ReactNode
  emptyHint?: string
  /** Drawn over the preview at the same scale. */
  overlay?: ReactNode
}) {
  const turned = Math.abs(rotation % 180) === 90

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-hairline px-4 py-3">
        <span className="label">{label}</span>
        {caption && <span className="truncate text-[12px] text-muted">{caption}</span>}
      </div>

      <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-hidden bg-plate-deep p-4 lg:min-h-[440px]">
        {src ? (
          <div className="relative" style={{ lineHeight: 0 }}>
            {overlay}
            <img
            src={src}
            alt=""
            draggable={false}
            className="select-none rounded-[6px] bg-page shadow-[var(--shadow-card)]"
            style={{
              transform: `rotate(${rotation}deg)`,
              // Rotating swaps the box: a turned page must fit the container's
              // height with its width, so bound the pre-rotation width by both
              // the height cap and the container width scaled by the aspect.
              maxWidth: turned ? `min(60vh, calc(100% * ${aspect}))` : '100%',
              maxHeight: turned ? 'none' : '60vh',
            }}
          />
          </div>
        ) : (
          <p className="max-w-[22ch] text-center text-[13px] text-muted">
            {emptyHint ?? 'Select something to see it here.'}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline px-3 py-2.5">
          {actions}
        </div>
      )}
    </div>
  )
}
