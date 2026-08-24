import { FlipHorizontal, FlipVertical, RotateCcw, RotateCw, Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dropzone } from '../../components/Dropzone'
import { Intake } from '../../components/Intake'
import { FileNameField, cleanFileName } from '../../components/FileNameField'
import { Residency, formatBytes as residencyBytes } from '../../components/Residency'
import { Workspace, WorkspaceError, WorkspaceButton } from '../Workspace'
import { downloadBlob } from '../../lib/pdf/export'
import {
  EXTENSION,
  FORMAT_LABELS,
  NO_EDIT,
  clampCrop,
  encodeUnder,
  formatBytes,
  fullFrameCrop,
  orientedSize,
  renderEdit,
  type Edit,
  type Format,
  type Source,
} from '../../lib/image/edit'
import { CropFrame } from './CropFrame'

const ACCEPT = 'image/jpeg,image/png,image/webp'

/** `undefined` leaves the crop free; `null` means "whatever the photo is". */
const RATIOS: Array<{ id: string; label: string; value: number | null | undefined }> = [
  { id: 'free', label: 'Free', value: undefined },
  { id: 'orig', label: 'Original', value: null },
  { id: 'sq', label: '1:1', value: 1 },
  { id: 'p43', label: '4:3', value: 4 / 3 },
  { id: 'p34', label: '3:4', value: 3 / 4 },
  { id: 'p169', label: '16:9', value: 16 / 9 },
  { id: 'pass', label: 'Passport', value: 35 / 45 },
]

/**
 * The shapes and budgets forms actually ask for. They are only starting
 * points — every field stays editable afterwards.
 */
const TARGETS = [
  { id: 'passport', label: 'Passport photo', w: 200, h: 230, kb: 50 },
  { id: 'sign', label: 'Signature', w: 140, h: 60, kb: 20 },
  { id: 'sq600', label: 'Square 600', w: 600, h: 600, kb: 100 },
  { id: 'k100', label: 'Under 100 KB', kb: 100 },
  { id: 'k500', label: 'Under 500 KB', kb: 500 },
  { id: 'm1', label: 'Under 1 MB', kb: 1024 },
]

function Group({
  label,
  onReset,
  children,
}: {
  label: string
  /** Shown only once something in the group has actually moved. */
  onReset?: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="meta">{label}</span>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="tap rounded-[3px] px-1.5 text-[12px] font-medium text-ink-quiet transition-colors duration-150 hover:text-ink"
          >
            Reset
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`tap rounded-[4px] px-2.5 py-1.5 text-[13px] font-medium transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        on
          ? 'bg-ink text-table'
          : 'text-ink-quiet hover:-translate-y-px hover:bg-table hover:text-ink hover:shadow-[var(--lift-1)]'
      }`}
    >
      {children}
    </button>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  reset,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
  format: (n: number) => string
  /** Where this control sits when nothing has been done to it. */
  reset: number
}) {
  const moved = Math.abs(value - reset) > step / 2
  return (
    <label className="block">
      <span className="meta flex items-baseline justify-between">
        <span>{label}</span>
        {/* The reading doubles as the way back: chasing an exact value with a
            thumb is the one thing a slider is bad at. */}
        <button
          type="button"
          onClick={() => onChange(reset)}
          title={moved ? 'Put this back' : undefined}
          /* Negative margin absorbs the padding, so the target grows without
             the row growing with it -- four of these would otherwise add a
             hundred pixels to a phone screen. */
          className={`data -my-3 rounded-[3px] px-2 py-3 ${
            moved
              ? 'text-ink underline decoration-dotted underline-offset-2'
              : 'text-ink-quiet'
          }`}
        >
          {format(value)}
        </button>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onDoubleClick={() => onChange(reset)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full cursor-pointer"
      />
    </label>
  )
}

export function EditPhoto() {
  const [source, setSource] = useState<(Source & { name: string; bytes: number }) | null>(null)
  const [edit, setEdit] = useState<Edit>({ ...NO_EDIT, crop: { x: 0, y: 0, w: 1, h: 1 } })
  const [ratioId, setRatioId] = useState('free')
  const [format, setFormat] = useState<Format>('image/jpeg')
  const [outW, setOutW] = useState(0)
  const [outH, setOutH] = useState(0)
  const [linked, setLinked] = useState(true)
  const [targetKb, setTargetKb] = useState<number | ''>('')
  const [outName, setOutName] = useState('photo')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [estimate, setEstimate] = useState<{ bytes: number; w: number; h: number; met: boolean } | null>(null)
  const [measuring, setMeasuring] = useState(false)

  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)

  const oriented = useMemo(
    () => (source ? orientedSize(source, edit.quarterTurns) : { width: 1, height: 1 }),
    [source, edit.quarterTurns],
  )

  const ratio = useMemo(() => {
    const found = RATIOS.find((r) => r.id === ratioId)
    if (!found) return undefined
    if (found.value === null) return oriented.width / oriented.height
    return found.value ?? undefined
  }, [ratioId, oriented])

  /* ── loading ─────────────────────────────────────────────── */

  const open = useCallback(async (file: File) => {
    setError(null)
    setBusy('Reading the photo…')
    try {
      const bitmap = await createImageBitmap(file)
      const src = {
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
        name: file.name,
        bytes: file.size,
      }
      setSource(src)
      const crop = fullFrameCrop(src, 0)
      setEdit({ ...NO_EDIT, crop })
      setRatioId('free')
      setOutW(Math.round(crop.w))
      setOutH(Math.round(crop.h))
      setTargetKb('')
      setOutName(cleanFileName(file.name.replace(/\.[^.]+$/, '')) || 'photo')
      setEstimate(null)
    } catch {
      setError('That image could not be read. JPG, PNG and WEBP work here.')
    } finally {
      setBusy(null)
    }
  }, [])

  const clearAll = useCallback(() => {
    source?.bitmap.close()
    setSource(null)
    setEstimate(null)
    setError(null)
    setBusy(null)
  }, [source])

  useEffect(() => () => source?.bitmap.close(), [source])

  /* ── the preview ─────────────────────────────────────────── */

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(() => setFrameWidth(el.clientWidth))
    ro.observe(el)
    setFrameWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [source])

  const scale = frameWidth && oriented.width ? frameWidth / oriented.width : 0

  useEffect(() => {
    const target = canvas.current
    if (!source || !target || !scale) return
    // The whole picture is drawn; the crop frame dims what falls outside it.
    const full = fullFrameCrop(source, edit.quarterTurns)
    const shown = renderEdit(
      source,
      { ...edit, crop: full },
      Math.round(oriented.width * scale),
      Math.round(oriented.height * scale),
    )
    target.width = shown.width
    target.height = shown.height
    target.getContext('2d')?.drawImage(shown, 0, 0)
  }, [source, edit, scale, oriented])

  /* ── keep the crop honest when the shape changes ─────────── */

  useEffect(() => {
    if (!source) return
    setEdit((e) => ({ ...e, crop: clampCrop(e.crop, oriented, ratio) }))
  }, [ratio, oriented, source])

  /* ── output size follows the crop unless it is overridden ── */

  const setWidth = (n: number) => {
    setOutW(n)
    if (linked && edit.crop.w) setOutH(Math.max(1, Math.round((n * edit.crop.h) / edit.crop.w)))
  }
  const setHeight = (n: number) => {
    setOutH(n)
    if (linked && edit.crop.h) setOutW(Math.max(1, Math.round((n * edit.crop.w) / edit.crop.h)))
  }

  useEffect(() => {
    setOutW(Math.round(edit.crop.w))
    setOutH(Math.round(edit.crop.h))
    // Only when the crop itself changes shape, not on every adjustment.
  }, [edit.crop.w, edit.crop.h])

  /* ── what the file will actually weigh ───────────────────── */

  useEffect(() => {
    if (!source || !outW || !outH) return
    let cancelled = false
    setMeasuring(true)
    const t = setTimeout(async () => {
      try {
        const r = await encodeUnder(
          source,
          edit,
          format,
          outW,
          outH,
          targetKb === '' ? undefined : Number(targetKb) * 1024,
        )
        if (!cancelled) setEstimate({ bytes: r.blob.size, w: r.width, h: r.height, met: r.metTarget })
      } catch {
        if (!cancelled) setEstimate(null)
      } finally {
        if (!cancelled) setMeasuring(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(t)
      setMeasuring(false)
    }
  }, [source, edit, format, outW, outH, targetKb])

  /* ── saving ──────────────────────────────────────────────── */

  const save = useCallback(async () => {
    if (!source) return
    setBusy('Preparing the image…')
    setError(null)
    try {
      const r = await encodeUnder(
        source,
        edit,
        format,
        outW,
        outH,
        targetKb === '' ? undefined : Number(targetKb) * 1024,
      )
      await downloadBlob(r.blob, `${cleanFileName(outName)}.${EXTENSION[format]}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The image could not be saved.')
    } finally {
      setBusy(null)
    }
  }, [source, edit, format, outW, outH, targetKb, outName])

  /* ── render ──────────────────────────────────────────────── */

  if (!source) {
    return (
      <Workspace title="Edit a photo">
        {error && <WorkspaceError>{error}</WorkspaceError>}
        <Intake
          does={[
            'Crop to any shape, or to a fixed one like a passport photo.',
            'Straighten, rotate and flip.',
            'Adjust brightness, contrast and colour.',
            'Save at an exact size, or under a file-size limit a form gives you.',
          ]}
          limit="Every edit is measured against the original picture and written once, when you save, so nothing is re-compressed along the way."
        >
          <Dropzone
            accept={ACCEPT}
            onFiles={(files) => void open(files[0])}
            title="Open a photo"
            hint="Choose a file, or drop one here. JPG, PNG and WEBP. It never leaves your device."
          />
        </Intake>
      </Workspace>
    )
  }

  const apply = (patch: Partial<Edit>) => setEdit((e) => ({ ...e, ...patch }))
  const turn = (dir: 1 | -1) =>
    apply({ quarterTurns: (((edit.quarterTurns + dir + 4) % 4) as Edit['quarterTurns']) })

  return (
    <Workspace
      title="Edit a photo"
      subtitle={
        <Residency
          name={source.name}
          detail={`${source.width} × ${source.height} · ${residencyBytes(source.bytes)} in this tab`}
        />
      }
      active
      onClear={clearAll}
      busy={busy}
    >
      {error && <WorkspaceError>{error}</WorkspaceError>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* the picture */}
        <div className="recess grid place-items-center overflow-hidden rounded-[6px] p-4 sm:p-6">
          <div
            ref={frame}
            className="relative w-full"
            style={{ maxWidth: oriented.width, aspectRatio: `${oriented.width} / ${oriented.height}` }}
          >
            <canvas ref={canvas} className="block h-full w-full rounded-[3px] shadow-[var(--lift-2)]" />
            {scale > 0 && (
              <CropFrame
                crop={edit.crop}
                bounds={oriented}
                scale={scale}
                ratio={ratio}
                onChange={(crop) => apply({ crop })}
              />
            )}
          </div>
        </div>

        {/* the controls */}
        <aside className="table-plane space-y-6 p-4 sm:p-5">
          <Group
            label="Crop"
            onReset={
              ratioId !== 'free' ||
              edit.crop.x !== 0 ||
              edit.crop.y !== 0 ||
              Math.round(edit.crop.w) !== oriented.width
                ? () => {
                    setRatioId('free')
                    apply({ crop: fullFrameCrop(source, edit.quarterTurns) })
                  }
                : undefined
            }
          >
            <div className="flex flex-wrap gap-1">
              {RATIOS.map((r) => (
                <Chip key={r.id} on={ratioId === r.id} onClick={() => setRatioId(r.id)}>
                  {r.label}
                </Chip>
              ))}
            </div>
          </Group>

          <Group
            label="Turn"
            onReset={
              edit.quarterTurns || edit.straighten || edit.flipX || edit.flipY
                ? () => apply({ quarterTurns: 0, straighten: 0, flipX: false, flipY: false })
                : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-1">
              <WorkspaceButton onClick={() => turn(-1)} icon={<RotateCcw size={15} />} iconOnly label="Rotate left" />
              <WorkspaceButton onClick={() => turn(1)} icon={<RotateCw size={15} />} iconOnly label="Rotate right" />
              <WorkspaceButton
                onClick={() => apply({ flipX: !edit.flipX })}
                icon={<FlipHorizontal size={15} />}
                iconOnly
                label="Flip horizontally"
              />
              <WorkspaceButton
                onClick={() => apply({ flipY: !edit.flipY })}
                icon={<FlipVertical size={15} />}
                iconOnly
                label="Flip vertically"
              />
            </div>
            <div className="mt-3">
              <Slider
                label="Straighten"
                value={edit.straighten}
                min={-45}
                max={45}
                step={0.1}
                onChange={(straighten) => apply({ straighten })}
                format={(n) => `${n.toFixed(1)}°`}
                reset={0}
              />
            </div>
          </Group>

          <Group
            label="Adjust"
            onReset={
              edit.brightness !== 1 || edit.contrast !== 1 || edit.saturation !== 1
                ? () => apply({ brightness: 1, contrast: 1, saturation: 1 })
                : undefined
            }
          >
            <div className="space-y-3">
              <Slider
                label="Brightness"
                value={edit.brightness}
                min={0.5}
                max={1.5}
                step={0.01}
                onChange={(brightness) => apply({ brightness })}
                format={(n) => `${Math.round(n * 100)}%`}
                reset={1}
              />
              <Slider
                label="Contrast"
                value={edit.contrast}
                min={0.5}
                max={1.5}
                step={0.01}
                onChange={(contrast) => apply({ contrast })}
                format={(n) => `${Math.round(n * 100)}%`}
                reset={1}
              />
              <Slider
                label="Colour"
                value={edit.saturation}
                min={0}
                max={2}
                step={0.01}
                onChange={(saturation) => apply({ saturation })}
                format={(n) => `${Math.round(n * 100)}%`}
                reset={1}
              />
            </div>
          </Group>

          <Group label="Save it as">
            <div className="flex flex-wrap gap-1">
              {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
                <Chip key={f} on={format === f} onClick={() => setFormat(f)}>
                  {FORMAT_LABELS[f]}
                </Chip>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="block">
                <span className="meta">Width</span>
                <input
                  type="number"
                  min={1}
                  value={outW}
                  onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))}
                  className="recess mt-1.5 w-full rounded-[4px] px-2.5 py-2 text-[13.5px] outline-none focus:shadow-[var(--cut-deep),0_0_0_2px_var(--ink)]"
                />
              </label>
              <button
                type="button"
                onClick={() => setLinked((l) => !l)}
                aria-pressed={linked}
                title={linked ? 'Width and height stay in proportion' : 'Width and height move freely'}
                className={`tap mb-1 rounded-[4px] px-2 py-1.5 text-[12px] font-medium ${
                  linked ? 'bg-ink text-table' : 'text-ink-quiet hover:bg-table hover:text-ink'
                }`}
              >
                {linked ? 'linked' : 'free'}
              </button>
              <label className="block">
                <span className="meta">Height</span>
                <input
                  type="number"
                  min={1}
                  value={outH}
                  onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))}
                  className="recess mt-1.5 w-full rounded-[4px] px-2.5 py-2 text-[13.5px] outline-none focus:shadow-[var(--cut-deep),0_0_0_2px_var(--ink)]"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="meta">Keep it under (KB) — leave empty for best quality</span>
              <input
                type="number"
                min={1}
                placeholder="no limit"
                value={targetKb}
                onChange={(e) => setTargetKb(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                className="recess mt-1.5 w-full rounded-[4px] px-2.5 py-2 text-[13.5px] outline-none focus:shadow-[var(--cut-deep),0_0_0_2px_var(--ink)]"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-1">
              {TARGETS.map((t) => (
                <Chip
                  key={t.id}
                  on={false}
                  onClick={() => {
                    if (t.w && t.h) {
                      setLinked(false)
                      setOutW(t.w)
                      setOutH(t.h)
                    }
                    setTargetKb(t.kb)
                    setFormat('image/jpeg')
                  }}
                >
                  {t.label}
                </Chip>
              ))}
            </div>
          </Group>

          <div className="border-t border-edge pt-4">
            <p className="data text-[12.5px] text-ink-quiet">
              {measuring
                ? 'measuring…'
                : estimate
                  ? `${estimate.w} × ${estimate.h} · ${formatBytes(estimate.bytes)}`
                  : '—'}
            </p>
            {estimate && !estimate.met && (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-stop">
                This will not fit under {targetKb} KB, even at the lowest quality. Try smaller
                dimensions, or raise the limit.
              </p>
            )}
            {estimate?.met && estimate.w !== outW && (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-faint">
                Quality alone was not enough, so it was scaled down to fit.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FileNameField
                value={outName}
                onChange={setOutName}
                label="Save as"
                extension={EXTENSION[format]}
              />
              <button
                type="button"
                onClick={() => void save()}
                disabled={!!busy}
                className="tap ml-auto inline-flex h-9 items-center gap-2 rounded-[4px] bg-ink px-4 text-[13.5px] font-semibold tracking-[-0.005em] text-table shadow-[var(--lift-1)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:-translate-y-px enabled:hover:shadow-[var(--lift-2)] disabled:pointer-events-none disabled:opacity-40"
              >
                <Download size={15} />
                Download
              </button>
            </div>
          </div>
        </aside>
      </div>
    </Workspace>
  )
}
