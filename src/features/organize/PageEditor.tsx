import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Italic,
  Maximize2,
  Minus,
  PenLine,
  Plus,
  RotateCw,
  Square,
  Pipette,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SignaturePad } from '../../components/SignaturePad'
import { Button } from '../../components/ui'
import { sampleRegionColour } from '../../lib/pdf/sampleColour'
import {
  FONT_LABELS,
  FONT_STACKS,
  inPaintOrder,
  measureTextBox,
  type Annotation,
  type FontId,
  type TextAlign,
  type TextAnnotation,
} from '../../lib/pdf/annotations'

let seq = 0
const nextId = () => `a${seq++}`

const ZOOM_MIN = 0.25
const ZOOM_MAX = 5

type Drag =
  | { mode: 'move'; id: string; px: number; py: number; ox: number; oy: number }
  | {
      mode: 'resize'
      id: string
      px: number
      py: number
      ow: number
      oh: number
      rot: number
      /** Point size at the start of the drag, for text. */
      osize?: number
    }
  | { mode: 'rotate'; id: string; cx: number; cy: number; start: number; orot: number }

type Props = {
  thumb?: string
  /** Rotation the user added to the page, which the thumbnail predates. */
  thumbRotation?: number
  /** Display box in PDF points, after the page's rotation. */
  boxWidth: number
  boxHeight: number
  pageLabel: string
  annotations: Annotation[]
  onChange: (next: Annotation[]) => void
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  flattened: boolean
  onToggleFlatten: () => void
  /** Renders this page crisply at a given on-screen width. */
  renderAtWidth?: (cssWidth: number) => Promise<string>
}

const DEFAULT_TEXT = {
  fontId: 'helvetica' as FontId,
  bold: false,
  italic: false,
  size: 24,
  color: '#000000',
  align: 'left' as TextAlign,
}

export function PageEditor({
  thumb,
  thumbRotation = 0,
  boxWidth,
  boxHeight,
  pageLabel,
  annotations,
  onChange,
  onClose,
  onPrev,
  onNext,
  flattened,
  onToggleFlatten,
  renderAtWidth,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [fitWidth, setFitWidth] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const drag = useRef<Drag | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [sharp, setSharp] = useState<string | null>(null)
  const sharpUrl = useRef<string | null>(null)

  const selected = annotations.find((a) => a.id === selectedId) ?? null
  const aspect = boxWidth / boxHeight
  const turnedThumb = Math.abs(thumbRotation % 180) === 90

  /* The page is only ever as big as the space it has; zoom multiplies that. */
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const measure = () => {
      const pad = 48
      const w = el.clientWidth - pad
      const h = el.clientHeight - pad
      setFitWidth(Math.max(120, Math.min(w, h * aspect)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])

  const pageWidth = fitWidth * zoom
  const pageHeight = pageWidth / aspect
  /** Screen pixels per PDF point — the bridge between the two coordinate systems. */
  const pxPerPoint = pageWidth / boxWidth

  /* Re-render the page whenever it grows meaningfully, so what is on screen
     is a raster made for this size rather than the grid's small thumbnail
     stretched up. Quantised so a slow zoom does not thrash the renderer. */
  const renderWidth = pageWidth ? Math.ceil(pageWidth / 400) * 400 : 0

  useEffect(() => {
    if (!renderAtWidth || !renderWidth) return
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const url = await renderAtWidth(renderWidth)
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        if (sharpUrl.current) URL.revokeObjectURL(sharpUrl.current)
        sharpUrl.current = url
        setSharp(url)
      } catch {
        /* keep whatever we are already showing */
      }
    }, 160)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [renderAtWidth, renderWidth])

  useEffect(
    () => () => {
      if (sharpUrl.current) URL.revokeObjectURL(sharpUrl.current)
      sharpUrl.current = null
    },
    [],
  )

  /* Only the editor scrolls while it is open, so the page behind it cannot
     contribute a second scrollbar. */
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  /* ── mutation ────────────────────────────────────────────── */

  const update = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      onChange(
        annotations.map((a) => {
          if (a.id !== id) return a
          const next = { ...a, ...patch } as Annotation
          // A box that has never been resized by hand keeps hugging its text.
          if (
            next.kind === 'text' &&
            next.autoFit !== false &&
            ('text' in patch || 'size' in patch || 'bold' in patch || 'italic' in patch || 'fontId' in patch)
          ) {
            const m = measureTextBox(next.text, next.fontId, next.bold, next.italic, next.size)
            next.width = m.width / boxWidth
            next.height = m.height / boxHeight
          }
          return next
        }),
      )
    },
    [annotations, boxHeight, boxWidth, onChange],
  )

  const add = useCallback(
    (a: Annotation) => {
      onChange([...annotations, a])
      setSelectedId(a.id)
    },
    [annotations, onChange],
  )

  const remove = useCallback(
    (id: string) => {
      onChange(annotations.filter((a) => a.id !== id))
      setSelectedId(null)
      setEditingId(null)
    },
    [annotations, onChange],
  )

  const duplicate = useCallback(
    (id: string) => {
      const a = annotations.find((x) => x.id === id)
      if (!a) return
      const copy = { ...a, id: nextId(), x: a.x + 0.02, y: a.y + 0.02 } as Annotation
      onChange([...annotations, copy])
      setSelectedId(copy.id)
    },
    [annotations, onChange],
  )

  const addText = () => {
    const label = 'New text'
    const m = measureTextBox(
      label,
      DEFAULT_TEXT.fontId,
      DEFAULT_TEXT.bold,
      DEFAULT_TEXT.italic,
      DEFAULT_TEXT.size,
    )
    const width = m.width / boxWidth
    const height = m.height / boxHeight
    const c = viewCentre()
    add({
      kind: 'text',
      id: nextId(),
      x: c.x - width / 2,
      y: c.y - height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      text: label,
      autoFit: true,
      ...DEFAULT_TEXT,
    })
  }

  /** Reads the page under a rect and returns the colour that dominates it. */
  const colourUnder = useCallback(
    async (rect: { x: number; y: number; width: number; height: number }) => {
      if (!thumb) return null
      try {
        return await sampleRegionColour(sharp ?? thumb, rect, aspect, thumbRotation)
      } catch {
        return null
      }
    },
    [aspect, sharp, thumb, thumbRotation],
  )

  const addCover = async () => {
    const c = viewCentre()
    const rect = { x: c.x - 0.225, y: c.y - 0.02, width: 0.45, height: 0.04 }
    // Match the paper straight away, so the box disappears into the page
    // instead of leaving a white patch on anything tinted or textured.
    const colour = (await colourUnder(rect)) ?? '#ffffff'
    add({
      kind: 'box',
      id: nextId(),
      ...rect,
      rotation: 0,
      opacity: 1,
      color: colour,
    })
  }

  const matchBackground = async (id: string) => {
    const a = annotations.find((x) => x.id === id)
    if (!a) return
    const colour = await colourUnder({ x: a.x, y: a.y, width: a.width, height: a.height })
    if (colour) update(id, { color: colour })
  }

  const addImage = (dataUrl: string, ratio: number) => {
    const width = 0.32
    const height = (width * boxWidth) / ratio / boxHeight
    const c = viewCentre()
    add({
      kind: 'image',
      id: nextId(),
      x: c.x - width / 2,
      y: c.y - height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      dataUrl,
    })
  }

  /* ── pointer interaction ─────────────────────────────────── */

  const rectOf = () => surface.current!.getBoundingClientRect()

  /**
   * The centre of whatever part of the page is on screen right now. Zoomed in
   * and scrolled to a signature block, a new object should land there rather
   * than at the top of a page you cannot see.
   */
  const viewCentre = () => {
    const s = surface.current?.getBoundingClientRect()
    const v = scroller.current?.getBoundingClientRect()
    if (!s || !v || !s.width || !s.height) return { x: 0.5, y: 0.35 }
    const left = Math.max(s.left, v.left)
    const right = Math.min(s.right, v.right)
    const top = Math.max(s.top, v.top)
    const bottom = Math.min(s.bottom, v.bottom)
    if (right <= left || bottom <= top) return { x: 0.5, y: 0.35 }
    return {
      x: ((left + right) / 2 - s.left) / s.width,
      y: ((top + bottom) / 2 - s.top) / s.height,
    }
  }

  const onPointerDown = (e: React.PointerEvent, id: string, mode: 'move' | 'resize' | 'rotate') => {
    if (editingId) return
    e.preventDefault()
    e.stopPropagation()
    const a = annotations.find((x) => x.id === id)
    if (!a) return
    setSelectedId(id)
    const r = rectOf()

    if (mode === 'move') {
      drag.current = { mode, id, px: e.clientX, py: e.clientY, ox: a.x, oy: a.y }
    } else if (mode === 'resize') {
      drag.current = {
        mode,
        id,
        px: e.clientX,
        py: e.clientY,
        ow: a.width,
        oh: a.height,
        rot: a.rotation,
        osize: a.kind === 'text' ? a.size : undefined,
      }
    } else {
      const cx = r.left + (a.x + a.width / 2) * r.width
      const cy = r.top + (a.y + a.height / 2) * r.height
      const start = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI
      drag.current = { mode, id, cx, cy, start, orot: a.rotation }
      setSpinning(true)
    }

    // Capture keeps the drag alive if the pointer leaves the handle, but it is
    // only an optimisation — losing it must not take the drag down with it, so
    // it is claimed after the drag state exists rather than before.
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone, or not capturable */
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const r = rectOf()

    if (d.mode === 'move') {
      update(d.id, {
        x: Math.min(1.2, Math.max(-0.2, d.ox + (e.clientX - d.px) / r.width)),
        y: Math.min(1.2, Math.max(-0.2, d.oy + (e.clientY - d.py) / r.height)),
      })
      return
    }

    if (d.mode === 'resize') {
      // Undo the object's rotation so the handle resizes along its own axes.
      const rad = (-d.rot * Math.PI) / 180
      const dx = e.clientX - d.px
      const dy = e.clientY - d.py
      const proposedW = d.ow + (dx * Math.cos(rad) - dy * Math.sin(rad)) / r.width
      const proposedH = d.oh + (dx * Math.sin(rad) + dy * Math.cos(rad)) / r.height

      if (d.osize) {
        // Text scales rather than stretches: the corner changes the point size
        // and the box is re-measured to hug it, so the letters never distort.
        const scale = Math.max(0.08, Math.max(proposedW / d.ow, proposedH / d.oh))
        const size = Math.min(400, Math.max(4, Math.round(d.osize * scale)))
        const a = annotations.find((x) => x.id === d.id)
        if (a?.kind === 'text') {
          const m = measureTextBox(a.text, a.fontId, a.bold, a.italic, size)
          update(d.id, {
            size,
            width: m.width / boxWidth,
            height: m.height / boxHeight,
          } as Partial<Annotation>)
        }
        return
      }

      update(d.id, {
        width: Math.max(0.03, proposedW),
        height: Math.max(0.012, proposedH),
      })
      return
    }

    const angle = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI
    let next = d.orot + (angle - d.start)
    if (e.shiftKey) next = Math.round(next / 15) * 15
    update(d.id, { rotation: Math.round(next * 10) / 10 })
  }

  const onPointerUp = () => {
    drag.current = null
    setSpinning(false)
  }

  /* ── keyboard ────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing =
        editingId ||
        (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) ||
        el?.isContentEditable

      if (e.key === 'Escape') {
        if (editingId) setEditingId(null)
        else if (selectedId) setSelectedId(null)
        else onClose()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        setZoom((z) => Math.min(ZOOM_MAX, z * 1.25))
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        setZoom((z) => Math.max(ZOOM_MIN, z / 1.25))
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        setZoom(1)
        return
      }
      if (typing || !selectedId) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        remove(selectedId)
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 0.02 : 0.004
        const a = annotations.find((x) => x.id === selectedId)
        if (!a) return
        update(selectedId, {
          x: a.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0),
          y: a.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0),
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [annotations, editingId, onClose, remove, selectedId, update])

  const text = selected?.kind === 'text' ? (selected as TextAnnotation) : null

  /* ── render ──────────────────────────────────────────────── */

  return (
    <div className="safe-top safe-bottom safe-x fixed inset-0 z-[60] flex flex-col bg-room">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-edge px-3 py-2.5 sm:gap-x-3 sm:px-4 sm:py-3">
        <button
          type="button"
          onClick={onClose}
          className="tap inline-flex h-9 items-center gap-2 rounded-[4px] bg-table px-3.5 text-[13.5px] font-semibold text-ink shadow-[var(--lift-1),var(--rim)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px"
        >
          <X size={15} />
          Done
        </button>

        <div className="flex items-center gap-1">
          <IconBtn label="Previous page" onClick={onPrev} disabled={!onPrev}>
            <ChevronLeft size={17} />
          </IconBtn>
          <span className="data min-w-[5.5rem] text-center text-[12.5px] font-medium sm:text-[13px] lg:min-w-[7rem]">{pageLabel}</span>
          <IconBtn label="Next page" onClick={onNext} disabled={!onNext}>
            <ChevronRight size={17} />
          </IconBtn>
        </div>

        <div className="flex items-center gap-0.5 rounded-[4px] border border-edge px-0.5">
          <IconBtn label="Zoom out" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z / 1.25))}>
            <Minus size={15} />
          </IconBtn>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Fit the page (Ctrl+0)"
            className="data tap min-w-[2.5rem] text-center text-[12.5px] font-medium text-ink-quiet transition-colors duration-200 hover:text-ink sm:min-w-[3.25rem]"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconBtn label="Zoom in" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z * 1.25))}>
            <Plus size={15} />
          </IconBtn>
          <span className="short-hide hidden sm:contents">
            <IconBtn label="Fit page" onClick={() => setZoom(1)}>
              <Maximize2 size={14} />
            </IconBtn>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="md" onClick={addText}>
            <Type size={15} />
            <span className="sm-label hidden sm:inline">Text</span>
          </Button>
          <Button variant="outline" size="md" onClick={() => void addCover()}>
            <Square size={15} />
            <span className="sm-label hidden sm:inline">Cover</span>
          </Button>
          <Button variant="outline" size="md" onClick={() => setSigning(true)}>
            <PenLine size={15} />
            <span className="sm-label hidden sm:inline">Signature</span>
          </Button>
          <Button variant="outline" size="md" onClick={() => fileInput.current?.click()}>
            <Upload size={15} />
            <span className="sm-label hidden sm:inline">Image</span>
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              const bitmap = await createImageBitmap(file)
              const c = document.createElement('canvas')
              c.width = bitmap.width
              c.height = bitmap.height
              c.getContext('2d')?.drawImage(bitmap, 0, 0)
              const ratio = bitmap.width / bitmap.height
              bitmap.close()
              addImage(c.toDataURL('image/png'), ratio)
            }}
          />
        </div>
      </div>

      <div className="editor-body flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          ref={scroller}
          className="recess grid min-h-0 flex-1 place-items-center overflow-auto p-4 sm:p-6"
        >
          <div
            ref={surface}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={() => {
              setSelectedId(null)
              setEditingId(null)
            }}
            className="relative shrink-0 bg-page shadow-[var(--shadow-lift)]"
            style={{ width: pageWidth || 320, height: pageHeight || 452 }}
          >
            {(sharp ?? thumb) && (
              <img
                src={sharp ?? thumb}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 m-auto select-none object-contain"
                style={{
                  transform: `rotate(${thumbRotation}deg)`,
                  width: turnedThumb ? `${100 / aspect}%` : '100%',
                  height: turnedThumb ? `${100 * aspect}%` : '100%',
                }}
              />
            )}

            {inPaintOrder(annotations).map((a) => {
              const active = a.id === selectedId
              const editing = a.id === editingId
              return (
                <div
                  key={a.id}
                  onPointerDown={(e) => onPointerDown(e, a.id, 'move')}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    if (a.kind === 'text') setEditingId(a.id)
                  }}
                  className={`absolute outline ${editing ? 'cursor-text' : 'cursor-move'} ${
                    active
                      ? 'outline-2 outline-ink'
                      : 'outline-1 outline-transparent hover:outline-[var(--ink)]'
                  }`}
                  style={{
                    left: `${a.x * 100}%`,
                    top: `${a.y * 100}%`,
                    width: `${a.width * 100}%`,
                    height: `${a.height * 100}%`,
                    transform: `rotate(${a.rotation}deg)`,
                    opacity: a.opacity,
                    touchAction: 'none',
                  }}
                >
                  {a.kind === 'box' && (
                    <div className="h-full w-full" style={{ background: a.color }} />
                  )}

                  {a.kind === 'image' && (
                    <img
                      src={a.dataUrl}
                      alt=""
                      draggable={false}
                      className="pointer-events-none h-full w-full select-none object-fill"
                    />
                  )}

                  {a.kind === 'text' && (
                    <div
                      contentEditable={editing}
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        update(a.id, { text: e.currentTarget.innerText })
                        setEditingId(null)
                      }}
                      className="h-full w-full whitespace-pre-wrap break-words outline-none"
                      style={{
                        fontFamily: FONT_STACKS[a.fontId],
                        fontWeight: a.bold ? 700 : 400,
                        fontStyle: a.italic ? 'italic' : 'normal',
                        color: a.color,
                        textAlign: a.align,
                        // Points converted to screen pixels at the current zoom,
                        // so what you see is the size the PDF will carry.
                        fontSize: `${Math.max(1, a.size * pxPerPoint)}px`,
                        lineHeight: 1.25,
                      }}
                    >
                      {a.text}
                    </div>
                  )}

                  {active && !editing && (
                    <>
                      <span
                        onPointerDown={(e) => onPointerDown(e, a.id, 'rotate')}
                        title="Drag to rotate — hold Shift to snap to 15°"
                        className="absolute -top-10 left-1/2 grid h-7 w-7 -translate-x-1/2 cursor-grab place-items-center rounded-full bg-action text-action-ink shadow-[var(--shadow)] active:cursor-grabbing"
                        style={{ touchAction: 'none' }}
                      >
                        <RotateCw size={14} />
                      </span>
                      <span className="pointer-events-none absolute -top-3.5 left-1/2 h-3.5 w-px -translate-x-1/2 bg-action" />
                      {spinning && (
                        <span className="pointer-events-none absolute -top-[4.6rem] left-1/2 -translate-x-1/2 rounded-sm bg-ink px-2 py-1 text-[11px] font-semibold text-bg">
                          {Math.round(a.rotation)}°
                        </span>
                      )}
                      <span
                        onPointerDown={(e) => onPointerDown(e, a.id, 'resize')}
                        title={a.kind === 'text' ? 'Drag to resize the text' : 'Drag to resize'}
                        className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-ink bg-surface"
                        style={{ touchAction: 'none' }}
                      />
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <aside className="editor-pane max-h-[42vh] w-full shrink-0 overflow-y-auto border-t border-edge bg-table px-4 py-3 shadow-[var(--lift-2)] sm:p-5 lg:max-h-none lg:w-[310px] lg:border-l lg:border-t-0 lg:shadow-none">
          {selected && (
            <details open className="sheet-disclosure">
              {/* The handle stays put when the rest is folded away, so what is
                  selected -- and the two things you are most likely to do to it
                  -- are still to hand while you look at the page. */}
              <summary className="sheet-handle">
                <span className="meta">{selected.kind === 'text' ? 'Text' : selected.kind === 'box' ? 'Cover' : 'Image'}</span>
                {/* preventDefault so acting on the selection does not also
                    fold the sheet underneath your finger */}
                <span
                  className="ml-auto flex items-center gap-1"
                  onClick={(e) => e.preventDefault()}
                >
                  <IconBtn label="Duplicate" onClick={() => duplicate(selected.id)}>
                    <Copy size={15} />
                  </IconBtn>
                  <button
                    type="button"
                    aria-label="Delete"
                    title="Delete"
                    onClick={() => remove(selected.id)}
                    className="tap grid h-9 w-9 shrink-0 place-items-center rounded-[4px] text-ink-quiet transition-colors duration-200 hover:bg-stop-wash hover:text-stop"
                  >
                    <Trash2 size={15} />
                  </button>

                  {/* Deleting and dismissing sit either side of a divider, so
                      the destructive one is never the neighbouring target. */}
                  <span aria-hidden="true" className="mx-1 h-5 w-px bg-edge" />

                  <IconBtn label="Close" onClick={() => setSelectedId(null)}>
                    <X size={15} />
                  </IconBtn>
                </span>
                <ChevronDown size={16} className="sheet-chevron shrink-0 text-ink-faint" />
              </summary>

              <div className="sheet-body space-y-5">

              {text && (
                <>
                  <label className="block">
                    <span className="meta">Content</span>
                    <textarea
                      value={text.text}
                      onChange={(e) => update(text.id, { text: e.target.value })}
                      rows={3}
                      className="recess mt-2 w-full resize-y rounded-[4px] px-3 py-2 text-[14px] outline-none focus:shadow-[var(--cut-deep),0_0_0_2px_var(--ink)]"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="meta">Font</span>
                      <select
                        value={text.fontId}
                        onChange={(e) => update(text.id, { fontId: e.target.value as FontId })}
                        className="recess mt-2 w-full rounded-[4px] px-2 py-2 text-[14px] outline-none focus:shadow-[var(--cut-deep),0_0_0_2px_var(--ink)]"
                      >
                        {(Object.keys(FONT_LABELS) as FontId[]).map((f) => (
                          <option key={f} value={f}>
                            {FONT_LABELS[f]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="meta">Size (pt)</span>
                      <input
                        type="number"
                        min={4}
                        max={400}
                        value={text.size}
                        onChange={(e) => update(text.id, { size: Number(e.target.value) || 12 })}
                        className="recess mt-2 w-full rounded-[4px] px-3 py-2 text-[14px] outline-none focus:shadow-[var(--cut-deep),0_0_0_2px_var(--ink)]"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Toggle
                      on={text.bold}
                      onClick={() => update(text.id, { bold: !text.bold })}
                      label="Bold"
                    >
                      <Bold size={15} />
                    </Toggle>
                    <Toggle
                      on={text.italic}
                      onClick={() => update(text.id, { italic: !text.italic })}
                      label="Italic"
                    >
                      <Italic size={15} />
                    </Toggle>
                    <span className="mx-1 w-px bg-[var(--line)]" />
                    {(
                      [
                        ['left', AlignLeft],
                        ['center', AlignCenter],
                        ['right', AlignRight],
                      ] as const
                    ).map(([value, Icon]) => (
                      <Toggle
                        key={value}
                        on={text.align === value}
                        onClick={() => update(text.id, { align: value })}
                        label={`Align ${value}`}
                      >
                        <Icon size={15} />
                      </Toggle>
                    ))}
                  </div>
                </>
              )}

              {selected.kind !== 'image' && (
                <div className="space-y-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="meta">{selected.kind === 'box' ? 'Fill' : 'Colour'}</span>
                    <input
                      type="color"
                      value={selected.color}
                      onChange={(e) => update(selected.id, { color: e.target.value })}
                      className="h-9 w-14 cursor-pointer rounded border border-line bg-transparent"
                    />
                  </label>

                  {selected.kind === 'box' && (
                    <button
                      type="button"
                      onClick={() => void matchBackground(selected.id)}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-sm border border-line text-[13px] font-semibold text-ink-2 transition-colors duration-200 hover:border-ink hover:text-ink"
                    >
                      <Pipette size={14} />
                      Match background here
                    </button>
                  )}
                </div>
              )}

              <label className="block">
                <span className="meta">Rotation — {Math.round(selected.rotation)}°</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={0.5}
                  value={selected.rotation}
                  onChange={(e) => update(selected.id, { rotation: Number(e.target.value) })}
                  className="mt-2 w-full cursor-pointer"
                />
              </label>

              <label className="block">
                <span className="meta">Opacity — {Math.round(selected.opacity * 100)}%</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={selected.opacity}
                  onChange={(e) => update(selected.id, { opacity: Number(e.target.value) })}
                  className="mt-2 w-full cursor-pointer"
                />
              </label>

                <p className="fine-only text-[12px] leading-relaxed text-ink-faint">
                  Arrow keys nudge, Shift+arrows move further. Ctrl +/− zooms, Ctrl 0 fits.
                  Double-click text to edit it on the page.
                </p>
              </div>
            </details>
          )}

          {/* Export option, kept out of the way of the drawing tools. */}
          <details className="mt-4 border-t border-edge pt-3 lg:mt-8 lg:pt-4">
            <summary className="tap flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-ink-quiet">
              <input
                type="checkbox"
                checked={flattened}
                onChange={onToggleFlatten}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 cursor-pointer accent-[var(--ink)]"
              />
              Flatten this page on export
            </summary>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
              A cover box hides text but leaves it in the file, still selectable. Flattening
              replaces the page with a picture of it, so covered content is genuinely gone. Your
              added text stays sharp. The page stops being searchable and the file grows.
            </p>
          </details>
        </aside>
      </div>

      {signing && (
        <SignaturePad
          onCancel={() => setSigning(false)}
          onDone={(dataUrl, ratio) => {
            setSigning(false)
            addImage(dataUrl, ratio)
          }}
        />
      )}
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="tap grid h-9 w-9 shrink-0 place-items-center rounded-[4px] text-ink-quiet transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:-translate-y-px enabled:hover:bg-table enabled:hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function Toggle({
  on,
  onClick,
  label,
  children,
}: {
  on: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`tap grid h-9 w-9 shrink-0 place-items-center rounded-[4px] border transition-colors duration-200 ${
        on ? 'border-ink bg-ink text-table' : 'border-edge text-ink-quiet hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
