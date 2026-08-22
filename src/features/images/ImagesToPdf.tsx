import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Download, RotateCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dropzone } from '../../components/Dropzone'
import { Workspace, WorkspaceError } from '../Workspace'
import {
  downloadBlob,
  imagesToPdf,
  type ImageOptions,
  type MarginId,
  type Orientation,
  type PageSizeId,
} from '../../lib/pdf/export'
import { ImageCard, type ImageItem } from './ImageCard'
import { FileNameField, cleanFileName } from '../../components/FileNameField'
import { FocusPane } from '../../components/FocusPane'
import { planGrid } from '../../lib/layout'
import { WorkspaceButton } from '../Workspace'

const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

let seq = 0
const nextId = () => `i${seq++}`

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className={disabled ? 'opacity-40' : undefined}>
      <p className="label mb-2 text-[10px] text-muted">{label}</p>
      <div className="inline-flex border border-hairline-strong">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            className={`border-r border-hairline-strong px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150 last:border-r-0 ${
              value === o.id
                ? 'bg-violet text-violet-ink'
                : 'text-body hover:bg-violet-wash hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ImagesToPdf() {
  const [items, setItems] = useState<ImageItem[]>([])
  const [options, setOptions] = useState<ImageOptions>({
    size: 'a4',
    orientation: 'portrait',
    margin: 'small',
    quality: 0.92,
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The image shown large in the focus panel — whichever you touched last.
  const [focusId, setFocusId] = useState<string | null>(null)
  const [outName, setOutName] = useState('images')

  // Mirror of state for the stable clearAll callback; synced in an effect
  // rather than during render, which React forbids.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const clearAll = useCallback(() => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url))
    setItems([])
    setError(null)
    setBusy(null)
  }, [])

  useEffect(() => clearAll, [clearAll])

  const add = useCallback((files: File[]) => {
    setError(null)
    setItems((current) => [
      ...current,
      ...files.map((file) => ({ id: nextId(), file, url: URL.createObjectURL(file), rotation: 0 })),
    ])
  }, [])

  const rotate = useCallback((id: string) => {
    setItems((current) =>
      current.map((i) => (i.id === id ? { ...i, rotation: (i.rotation + 90) % 360 } : i)),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setItems((current) => {
      const hit = current.find((i) => i.id === id)
      if (hit) URL.revokeObjectURL(hit.url)
      return current.filter((i) => i.id !== id)
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((current) => {
      const from = current.findIndex((i) => i.id === active.id)
      const to = current.findIndex((i) => i.id === over.id)
      return from < 0 || to < 0 ? current : arrayMove(current, from, to)
    })
  }, [])

  const save = useCallback(async () => {
    if (!items.length) return
    setError(null)
    setBusy('Building PDF…')
    try {
      const blob = await imagesToPdf(
        items.map((i) => ({ file: i.file, rotation: i.rotation })),
        options,
        (done, total) => setBusy(`Adding image ${done} of ${total}…`),
      )
      downloadBlob(blob, `${cleanFileName(outName)}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the PDF.')
    } finally {
      setBusy(null)
    }
  }, [items, options, outName])

  const plan = planGrid(items.length)
  // Fall back to the first image when the focused one has been removed.
  const focusIndex = Math.max(
    0,
    items.findIndex((i) => i.id === focusId),
  )
  const focusItem = items[focusIndex]

  if (!items.length) {
    return (
      <Workspace item="02" title="Image to PDF" subtitle="Turn JPG, PNG and WEBP files into one PDF.">
        {error && <WorkspaceError>{error}</WorkspaceError>}
        <Dropzone
          accept={ACCEPT}
          multiple
          onFiles={add}
          title="Drop images here"
          hint="JPG, PNG and WEBP. They stay on your device; nothing is sent anywhere."
        />
      </Workspace>
    )
  }

  return (
    <Workspace
      item="02"
     
      title="Image to PDF"
      subtitle={`${items.length} image${items.length === 1 ? '' : 's'}`}
      active
      onClear={clearAll}
      busy={busy}
    >
      {error && <WorkspaceError>{error}</WorkspaceError>}

      <div className="card mb-5 flex flex-wrap items-end gap-x-8 gap-y-5 p-5">
        <Segmented
          label="Page size"
          value={options.size}
          onChange={(size: PageSizeId) => setOptions((o) => ({ ...o, size }))}
          options={[
            { id: 'a4', label: 'A4' },
            { id: 'letter', label: 'Letter' },
            { id: 'fit', label: 'Fit to image' },
          ]}
        />
        <Segmented
          label="Orientation"
          value={options.orientation}
          disabled={options.size === 'fit'}
          onChange={(orientation: Orientation) => setOptions((o) => ({ ...o, orientation }))}
          options={[
            { id: 'portrait', label: 'Portrait' },
            { id: 'landscape', label: 'Landscape' },
          ]}
        />
        <Segmented
          label="Margin"
          value={options.margin}
          onChange={(margin: MarginId) => setOptions((o) => ({ ...o, margin }))}
          options={[
            { id: 'none', label: 'None' },
            { id: 'small', label: 'S' },
            { id: 'medium', label: 'M' },
            { id: 'large', label: 'L' },
          ]}
        />

        <div>
          <label htmlFor="quality" className="label mb-2 block text-[10px] text-muted">
            Quality — {Math.round(options.quality * 100)}%
          </label>
          <input
            id="quality"
            type="range"
            min={0.4}
            max={1}
            step={0.02}
            value={options.quality}
            onChange={(e) => setOptions((o) => ({ ...o, quality: Number(e.target.value) }))}
            className="h-1 w-40 cursor-pointer appearance-none bg-[var(--hairline-strong)]"
          />
        </div>

        <div className="ml-auto">
          <FileNameField value={outName} onChange={setOutName} />
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={!!busy}
          className="inline-flex h-9 items-center gap-2 bg-violet px-5 text-[11px] font-semibold uppercase tracking-[0.07em] text-violet-ink transition-[filter] duration-150 hover:brightness-110 disabled:opacity-35"
        >
          <Download size={15} />
          Download PDF
        </button>
      </div>

      <>
        <div className={plan.focusPanel ? 'grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]' : ''}>
          {plan.focusPanel && (
            <div className="lg:sticky lg:top-[88px] lg:self-start">
              <FocusPane
                label={focusItem ? `Image ${focusIndex + 1} of ${items.length}` : 'No image selected'}
                caption={focusItem?.file.name}
                src={focusItem?.url}
                rotation={focusItem?.rotation ?? 0}
                aspect={1}
                emptyHint="Click any image to see it at full size here."
                actions={
                  focusItem && (
                    <>
                      <WorkspaceButton onClick={() => rotate(focusItem.id)} icon={<RotateCw size={15} />}>
                        Rotate
                      </WorkspaceButton>
                      <WorkspaceButton onClick={() => remove(focusItem.id)} icon={<Trash2 size={15} />}>
                        Remove
                      </WorkspaceButton>
                    </>
                  )
                }
              />
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
              <div className={`grid gap-4 ${plan.columns} ${plan.maxWidth}`}>
                {items.map((item, i) => (
                  <ImageCard
                    key={item.id}
                    item={item}
                    index={i}
                    focused={plan.focusPanel && item.id === focusItem?.id}
                    onSelect={setFocusId}
                    onRotate={rotate}
                    onDelete={remove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </>

      <div className="mt-4">
        <Dropzone accept={ACCEPT} multiple onFiles={add} compact title="Add more images" hint="Drop or choose to append." />
      </div>
    </Workspace>
  )
}
