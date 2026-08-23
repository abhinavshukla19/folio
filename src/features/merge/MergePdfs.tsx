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
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Download, GripVertical, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Dropzone } from '../../components/Dropzone'
import { Intake } from '../../components/Intake'
import { FileNameField, cleanFileName } from '../../components/FileNameField'
import { Workspace, WorkspaceError } from '../Workspace'
import { downloadBlob, mergePdfs } from '../../lib/pdf/export'
import { EncryptedPdfError, loadPdf, renderThumbnail } from '../../lib/pdf/pdfjs'

/** Merging more than a handful at once stops being a merge and starts being a
 *  build step; five keeps the reordering legible and the memory sane. */
const MAX_FILES = 5

let seq = 0
const nextId = () => `m${seq++}`

type Doc = {
  id: string
  name: string
  bytes: Uint8Array
  pageCount: number
  thumb?: string
}

function SortableDoc({
  doc,
  index,
  onRemove,
}: {
  doc: Doc
  index: number
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: doc.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        boxShadow: isDragging ? 'var(--lift-2)' : undefined,
      }}
      className={`group relative flex min-w-0 items-center gap-3 rounded-[5px] bg-table p-2.5 shadow-[var(--lift-1),var(--rim)] sm:gap-4 sm:p-3 ${isDragging ? 'z-20' : ''}`}
    >
      <span
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="grid h-10 w-6 shrink-0 cursor-grab touch-none place-items-center text-ink-faint active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </span>

      <span className="data w-5 shrink-0 text-[12.5px] font-medium text-ink-faint">{index + 1}</span>

      <span className="h-12 w-9 shrink-0 overflow-hidden rounded-[3px] bg-sheet shadow-[var(--lift-1)] sm:h-16 sm:w-12">
        {doc.thumb && (
          <img src={doc.thumb} alt="" className="h-full w-full object-contain" draggable={false} />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold" title={doc.name}>
          {doc.name}
        </span>
        <span className="data mt-0.5 block text-[12px] text-ink-quiet">
          {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}
        </span>
      </span>

      <button
        type="button"
        aria-label={`Remove ${doc.name}`}
        title="Remove"
        onClick={() => onRemove(doc.id)}
        className="tap on-hover grid h-9 w-9 shrink-0 place-items-center rounded-[4px] text-ink-quiet transition-colors duration-200 hover:bg-stop-wash hover:text-stop"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

export function MergePdfs() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outName, setOutName] = useState('merged')
  const [confirming, setConfirming] = useState(false)

  const docsRef = useRef(docs)
  useEffect(() => {
    docsRef.current = docs
  }, [docs])

  const clearAll = useCallback(() => {
    docsRef.current.forEach((d) => d.thumb && URL.revokeObjectURL(d.thumb))
    setDocs([])
    setError(null)
    setBusy(null)
  }, [])

  useEffect(() => clearAll, [clearAll])

  const add = useCallback(async (files: File[]) => {
    setError(null)
    const room = MAX_FILES - docsRef.current.length
    if (room <= 0) {
      setError(`You can merge up to ${MAX_FILES} PDFs at once. Remove one to add another.`)
      return
    }

    const taking = files.slice(0, room)
    const skipped = files.length - taking.length
    setBusy('Reading…')

    const added: Doc[] = []
    const failed: string[] = []

    for (const file of taking) {
      try {
        const loaded = await loadPdf(file)
        let thumb: string | undefined
        try {
          thumb = await renderThumbnail(loaded.doc, 1, 300)
        } catch {
          /* a document that will not draw can still be merged */
        }
        added.push({
          id: nextId(),
          name: file.name,
          bytes: loaded.bytes,
          pageCount: loaded.pageCount,
          thumb,
        })
        // The bytes are kept for merging; the renderer is not needed again.
        void loaded.doc.loadingTask.destroy()
      } catch (err) {
        failed.push(
          err instanceof EncryptedPdfError
            ? `${file.name} is password protected`
            : `${file.name} could not be read`,
        )
      }
    }

    setDocs((current) => [...current, ...added])
    setBusy(null)

    const notes = [...failed]
    if (skipped > 0) notes.push(`${skipped} file${skipped === 1 ? '' : 's'} skipped — the limit is ${MAX_FILES}`)
    if (notes.length) setError(notes.join('. ') + '.')
  }, [])

  const remove = useCallback((id: string) => {
    setDocs((current) => {
      const hit = current.find((d) => d.id === id)
      if (hit?.thumb) URL.revokeObjectURL(hit.thumb)
      return current.filter((d) => d.id !== id)
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setDocs((current) => {
      const from = current.findIndex((d) => d.id === active.id)
      const to = current.findIndex((d) => d.id === over.id)
      return from < 0 || to < 0 ? current : arrayMove(current, from, to)
    })
  }, [])

  const save = useCallback(async () => {
    if (docs.length < 2) return
    setError(null)
    setBusy('Merging…')
    try {
      const blob = await mergePdfs(
        docs.map((d) => ({ name: d.name, bytes: d.bytes })),
        (done, total) => setBusy(`Adding document ${done} of ${total}…`),
      )
      downloadBlob(blob, `${cleanFileName(outName)}.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not merge these files.')
    } finally {
      setBusy(null)
    }
  }, [docs, outName])

  const totalPages = docs.reduce((n, d) => n + d.pageCount, 0)
  const full = docs.length >= MAX_FILES

  if (!docs.length) {
    return (
      <Workspace title="Merge PDFs">
        {error && <WorkspaceError>{error}</WorkspaceError>}
        <Intake
          does={[
            `Join up to ${MAX_FILES} documents into one.`,
            'Drag the files into the order you want them.',
            'Pages are joined top to bottom, in that order.',
            'Name the result, then save it.',
          ]}
          limit="Password-protected PDFs cannot be opened. Remove the password in your PDF reader first."
        >
          <Dropzone
            accept="application/pdf,.pdf"
            multiple
            onFiles={(files) => void add(files)}
            title="Open several PDFs"
            hint={`Choose up to ${MAX_FILES} files, or drop them here. They never leave your device.`}
          />
        </Intake>
      </Workspace>
    )
  }

  return (
    <Workspace
      item="03"
      title="Merge PDFs"
      subtitle={`${docs.length} of ${MAX_FILES} files · ${totalPages} page${totalPages === 1 ? '' : 's'} in total`}
      active
      onClear={() => setConfirming(true)}
      busy={busy}
    >
      {error && <WorkspaceError>{error}</WorkspaceError>}

      <div className="panel mb-5 flex flex-wrap items-center gap-4 p-4">
        <p className="text-[14px] text-ink-2">
          Pages are joined top to bottom. Drag a file to change where it lands.
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <FileNameField value={outName} onChange={setOutName} />
          <button
            type="button"
            onClick={() => void save()}
            disabled={!!busy || docs.length < 2}
            title={docs.length < 2 ? 'Add a second PDF to merge' : undefined}
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-action px-5 text-[13px] font-semibold text-action-ink transition-colors duration-200 hover:bg-action-hover disabled:opacity-40"
          >
            <Download size={15} />
            Merge &amp; download
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={docs.map((d) => d.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-3">
            {docs.map((doc, i) => (
              <SortableDoc key={doc.id} doc={doc} index={i} onRemove={remove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-5">
        {full ? (
          <p className="panel p-5 text-center text-[14px] text-ink-2">
            That is the limit of {MAX_FILES}. Remove a file to swap in another.
          </p>
        ) : (
          <Dropzone
            accept="application/pdf,.pdf"
            multiple
            onFiles={(files) => void add(files)}
            compact
            title={`Add another PDF (${MAX_FILES - docs.length} slot${MAX_FILES - docs.length === 1 ? '' : 's'} left)`}
            hint="Drop or choose to append."
          />
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title="Clear these files?"
          body="All the documents you have added are removed from memory. You would need to open them again from your device."
          confirmLabel="Clear everything"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            clearAll()
          }}
        />
      )}
    </Workspace>
  )
}
