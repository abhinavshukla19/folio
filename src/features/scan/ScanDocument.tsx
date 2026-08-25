import { Camera as CameraIcon, Download, Image as ImageIcon, RotateCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dropzone } from '../../components/Dropzone'
import { Intake } from '../../components/Intake'
import { FileNameField, cleanFileName } from '../../components/FileNameField'
import { Residency } from '../../components/Residency'
import { Workspace, WorkspaceError } from '../Workspace'
import { downloadBlob, imagesToPdf, type MarginId, type PageSizeId } from '../../lib/pdf/export'
import { detectPage, fullFrame, type Quad } from '../../lib/scan/detect'
import { ENHANCERS, flatten, thumbnail, toFile, type Enhance } from '../../lib/scan/page'
import { Camera } from './Camera'
import { QuadFrame } from './QuadFrame'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/** A page that has been captured and accepted. */
type Page = {
  id: string
  /** The finished, flattened image. */
  data: ImageData
  preview: string
  rotation: number
}

/** The photograph currently being framed, before it becomes a page. */
type Pending = {
  bitmap: ImageBitmap
  quad: Quad
  /** True when detection found the page rather than falling back. */
  detected: boolean
}

type Stage = 'idle' | 'camera' | 'framing'

const SIZES: { id: PageSizeId; label: string }[] = [
  { id: 'a4', label: 'A4' },
  { id: 'letter', label: 'Letter' },
  { id: 'fit', label: 'Fit the page' },
]

const MARGIN_CHOICES: { id: MarginId; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
]

let counter = 0
const nextId = () => `page-${++counter}`

export function ScanDocument() {
  const [stage, setStage] = useState<Stage>('idle')
  const [pending, setPending] = useState<Pending | null>(null)
  const [enhance, setEnhance] = useState<Enhance>('text')
  const [pages, setPages] = useState<Page[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [size, setSize] = useState<PageSizeId>('a4')
  const [margin, setMargin] = useState<MarginId>('small')
  const [name, setName] = useState('scan')

  const [hasCamera, setHasCamera] = useState(false)

  const frame = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  /* ── is there even a camera to offer? ─────────────────────── */

  useEffect(() => {
    let alive = true
    const look = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (alive) setHasCamera(devices.some((d) => d.kind === 'videoinput'))
      } catch {
        /* leave it off; the file route always works */
      }
    }
    void look()
    return () => {
      alive = false
    }
  }, [])

  /* ── the framing preview is fitted to the space, not the photo ── */

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    read()
    return () => ro.disconnect()
  }, [pending])

  const scale = pending
    ? Math.min(box.w / pending.bitmap.width || 0, box.h / pending.bitmap.height || 0, 1)
    : 0

  /* ── taking a photograph in ───────────────────────────────── */

  const accept = useCallback((bitmap: ImageBitmap) => {
    const found = detectPage(bitmap)
    setPending({
      bitmap,
      quad: found ?? fullFrame(bitmap.width, bitmap.height),
      detected: !!found,
    })
    setStage('framing')
  }, [])

  const openFiles = useCallback(async (files: File[]) => {
    setError(null)
    setBusy('Reading the photo…')
    try {
      const bitmap = await createImageBitmap(files[0])
      accept(bitmap)
    } catch {
      setError('That image could not be read. JPG, PNG and WEBP work here.')
    } finally {
      setBusy(null)
    }
  }, [accept])

  /* ── turning the framed photograph into a page ────────────── */

  const keep = useCallback(async () => {
    if (!pending) return
    setBusy('Flattening the page…')
    setError(null)
    // Yield once so the busy line paints before the main thread is taken.
    await new Promise((r) => setTimeout(r, 16))
    try {
      const data = flatten(pending.bitmap, pending.quad, enhance)
      if (!data) throw new Error('flatten failed')
      setPages((list) => [...list, { id: nextId(), data, preview: thumbnail(data), rotation: 0 }])
      pending.bitmap.close()
      setPending(null)
      setStage('idle')
    } catch {
      setError('That page could not be flattened. Try moving the corners and again.')
    } finally {
      setBusy(null)
    }
  }, [pending, enhance])

  const discard = useCallback(() => {
    pending?.bitmap.close()
    setPending(null)
    setStage('idle')
  }, [pending])

  const clearAll = useCallback(() => {
    pending?.bitmap.close()
    setPending(null)
    setPages([])
    setStage('idle')
    setError(null)
    setBusy(null)
  }, [pending])

  /* ── the finished document ────────────────────────────────── */

  const save = useCallback(async () => {
    if (!pages.length) return
    setError(null)
    setBusy('Building the PDF…')
    try {
      const files = await Promise.all(
        pages.map((p, i) => toFile(p.data, `page-${i + 1}.jpg`)),
      )
      const blob = await imagesToPdf(
        files.map((file, i) => ({ file, rotation: pages[i].rotation })),
        { size, orientation: 'portrait', margin, quality: 0.9 },
        (done, total) => setBusy(`Building the PDF — page ${done} of ${total}…`),
      )
      await downloadBlob(blob, `${cleanFileName(name) || 'scan'}.pdf`)
    } catch {
      setError('That document could not be saved.')
    } finally {
      setBusy(null)
    }
  }, [pages, size, margin, name])

  /* ── empty ────────────────────────────────────────────────── */

  if (stage === 'idle' && !pages.length) {
    return (
      <Workspace title="Scan to PDF" busy={busy}>
        {error && <WorkspaceError>{error}</WorkspaceError>}
        <Intake
          does={[
            'Photograph a page and have its corners found for you.',
            'Straighten the perspective, so a page shot at an angle comes back square.',
            'Clean it up: colour, greyscale, or black on white with the shadow taken out.',
            'Add page after page, then save the lot as one PDF.',
          ]}
          limit="The camera, the flattening and the PDF all run in this tab. No photograph is uploaded, and there is nowhere for it to go."
        >
          <div className="flex flex-col gap-2 sm:gap-2.5">
            {hasCamera && (
              <button
                type="button"
                onClick={() => setStage('camera')}
                className="slot recess flex cursor-pointer flex-col items-center justify-center rounded-[6px] px-5 py-10 text-center"
              >
                <CameraIcon size={30} className="mb-4 text-ink-faint" aria-hidden="true" />
                <p className="text-[17px] font-semibold tracking-[-0.01em]">Use the camera</p>
                <p className="mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-quiet">
                  Point at the page and take the shot. Nothing is recorded but the frame you keep.
                </p>
              </button>
            )}

            <Dropzone
              accept={ACCEPT}
              mark="picture"
              onFiles={(files) => void openFiles(files)}
              title={hasCamera ? 'Or open a photo you already have' : 'Open a photo of a page'}
              hint="Choose a file, or drop one here. JPG, PNG and WEBP. It never leaves your device."
              compact={hasCamera}
            />
          </div>
        </Intake>
      </Workspace>
    )
  }

  /* ── the viewfinder ───────────────────────────────────────── */

  if (stage === 'camera') {
    return (
      <Workspace title="Scan to PDF" subtitle="Point at the page" busy={busy}>
        {error && <WorkspaceError>{error}</WorkspaceError>}
        <Camera onCapture={accept} onCancel={() => setStage('idle')} />
      </Workspace>
    )
  }

  /* ── framing what was just taken ──────────────────────────── */

  if (stage === 'framing' && pending) {
    const shown = {
      width: Math.round(pending.bitmap.width * scale),
      height: Math.round(pending.bitmap.height * scale),
    }
    return (
      <Workspace
        title="Scan to PDF"
        subtitle={pending.detected ? 'Page found — drag a corner to correct it' : 'Drag the corners onto the page'}
        busy={busy}
      >
        {error && <WorkspaceError>{error}</WorkspaceError>}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="recess flex h-[46dvh] min-h-[13rem] overflow-hidden rounded-[6px] p-3 sm:h-[52dvh] sm:p-4 lg:h-[calc(100dvh-15rem)]">
            <div ref={frame} className="grid min-h-0 min-w-0 flex-1 place-items-center">
              <div className="relative" style={shown}>
                <PhotoCanvas bitmap={pending.bitmap} width={shown.width} height={shown.height} />
                {scale > 0 && (
                  <QuadFrame
                    quad={pending.quad}
                    bounds={{ width: pending.bitmap.width, height: pending.bitmap.height }}
                    scale={scale}
                    onChange={(quad) => setPending({ ...pending, quad })}
                  />
                )}
              </div>
            </div>
          </div>

          <aside className="table-plane min-h-0 space-y-6 p-4 sm:p-5 lg:overflow-y-auto">
            <div>
              <span className="meta mb-2 block">Clean up</span>
              <div className="flex flex-col gap-1.5">
                {ENHANCERS.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEnhance(e.id)}
                    className={`tap rounded-[4px] px-3 py-2 text-left transition-colors duration-150 ${
                      enhance === e.id
                        ? 'bg-accent text-accent-ink'
                        : 'text-ink-quiet hover:bg-recess hover:text-ink'
                    }`}
                  >
                    <span className="block text-[13.5px] font-semibold">{e.label}</span>
                    <span
                      className={`mt-0.5 block text-[12px] leading-snug ${
                        enhance === e.id ? 'text-accent-ink/75' : 'text-ink-faint'
                      }`}
                    >
                      {e.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="meta mb-2 block">Corners</span>
              <p className="text-[13px] leading-relaxed text-ink-quiet">
                {pending.detected
                  ? 'The page was found automatically. Drag any corner if it has misjudged an edge.'
                  : 'No page could be found in this photograph — likely because it is on a surface of a similar tone. Drag each corner onto one of the page’s.'}
              </p>
              <button
                type="button"
                onClick={() =>
                  setPending({
                    ...pending,
                    quad: fullFrame(pending.bitmap.width, pending.bitmap.height),
                  })
                }
                className="tap mt-2.5 rounded-[3px] px-1.5 text-[12px] font-medium text-ink-quiet transition-colors duration-150 hover:text-ink"
              >
                Reset the corners
              </button>
            </div>

            {/* On a phone this bar is pinned to the bottom of the screen, where
                a camera app puts its shutter. Left in the flow it lands below
                a column of options, so confirming a photo you have just taken
                would mean scrolling past every one of them first. The outer
                element carries only the safe-area inset -- the padding classes
                belong on the inner one, since the safe-area rule sets padding
                outright and would otherwise flatten them. */}
            <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-edge bg-table shadow-[var(--lift-2)] lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:shadow-none">
              <div className="mx-auto flex max-w-[100rem] items-center gap-2 px-5 py-3 sm:px-8 lg:border-t lg:border-edge-soft lg:px-0 lg:pb-0 lg:pt-4">
                <button
                  type="button"
                  onClick={() => void keep()}
                  disabled={!!busy}
                  className="tap inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[4px] bg-accent px-4 text-[13.5px] font-semibold text-accent-ink shadow-[var(--lift-1)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:-translate-y-px disabled:opacity-40 lg:h-9 lg:flex-none"
                >
                  Keep this page
                </button>
                <button
                  type="button"
                  onClick={discard}
                  className="tap inline-flex h-10 shrink-0 items-center rounded-[4px] px-4 text-[13.5px] font-semibold text-ink-quiet transition-colors duration-150 hover:text-ink lg:h-9 lg:px-3"
                >
                  Discard
                </button>
              </div>
            </div>
          </aside>
        </div>
      </Workspace>
    )
  }

  /* ── the pages so far ─────────────────────────────────────── */

  return (
    <Workspace
      title="Scan to PDF"
      subtitle={
        <Residency
          name={`${pages.length} page${pages.length === 1 ? '' : 's'}`}
          detail="held in this tab"
        />
      }
      active
      onClear={clearAll}
      busy={busy}
    >
      {error && <WorkspaceError>{error}</WorkspaceError>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="table-plane p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {pages.map((page, i) => (
              <figure key={page.id} className="group relative">
                <div className="recess grid place-items-center overflow-hidden rounded-[5px] p-2">
                  <img
                    src={page.preview}
                    alt={`Page ${i + 1}`}
                    className="block max-h-[26vh] w-auto max-w-full rounded-[2px] shadow-[var(--lift-1)]"
                    style={{ transform: `rotate(${page.rotation}deg)` }}
                  />
                </div>
                <figcaption className="mt-1.5 flex items-center gap-1.5">
                  <span className="data text-[12px] text-ink-quiet">{i + 1}</span>
                  <button
                    type="button"
                    aria-label={`Rotate page ${i + 1}`}
                    onClick={() =>
                      setPages((list) =>
                        list.map((p) =>
                          p.id === page.id ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
                        ),
                      )
                    }
                    className="tap ml-auto grid h-7 w-7 place-items-center rounded-[4px] text-ink-quiet transition-colors duration-150 hover:bg-recess hover:text-ink"
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete page ${i + 1}`}
                    onClick={() => setPages((list) => list.filter((p) => p.id !== page.id))}
                    className="tap grid h-7 w-7 place-items-center rounded-[4px] text-ink-quiet transition-colors duration-150 hover:bg-stop-wash hover:text-stop"
                  >
                    <Trash2 size={14} />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {hasCamera && (
              <button
                type="button"
                onClick={() => setStage('camera')}
                className="tap inline-flex h-9 items-center gap-2 rounded-[4px] bg-table px-3.5 text-[13.5px] font-semibold text-ink shadow-[var(--lift-1),var(--rim)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px"
              >
                <CameraIcon size={15} />
                Add another page
              </button>
            )}
            <label className="tap inline-flex h-9 cursor-pointer items-center gap-2 rounded-[4px] bg-table px-3.5 text-[13.5px] font-semibold text-ink shadow-[var(--lift-1),var(--rim)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px">
              <ImageIcon size={15} />
              Add from a photo
              <input
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void openFiles([f])
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        </div>

        <aside className="table-plane space-y-6 p-4 sm:p-5">
          <div>
            <span className="meta mb-2 block">Page size</span>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSize(s.id)}
                  className={`tap rounded-[4px] px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                    size === s.id
                      ? 'bg-accent text-accent-ink'
                      : 'text-ink-quiet hover:bg-recess hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="meta mb-2 block">Margin</span>
            <div className="flex flex-wrap gap-1.5">
              {MARGIN_CHOICES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMargin(m.id)}
                  className={`tap rounded-[4px] px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                    margin === m.id
                      ? 'bg-accent text-accent-ink'
                      : 'text-ink-quiet hover:bg-recess hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-edge-soft pt-4">
            <FileNameField value={name} onChange={setName} extension="pdf" />
            <button
              type="button"
              onClick={() => void save()}
              disabled={!pages.length || !!busy}
              className="tap inline-flex h-9 w-full items-center justify-center gap-2 rounded-[4px] bg-accent px-4 text-[13.5px] font-semibold text-accent-ink shadow-[var(--lift-1)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:-translate-y-px disabled:pointer-events-none disabled:opacity-40"
            >
              <Download size={15} />
              Save as PDF
            </button>
          </div>
        </aside>
      </div>
    </Workspace>
  )
}

/** The captured photograph, drawn once at the size it is shown. */
function PhotoCanvas({
  bitmap,
  width,
  height,
}: {
  bitmap: ImageBitmap
  width: number
  height: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !width || !height) return
    el.width = width
    el.height = height
    el.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  }, [bitmap, width, height])

  return <canvas ref={ref} className="block h-full w-full rounded-[3px] shadow-[var(--lift-2)]" />
}
