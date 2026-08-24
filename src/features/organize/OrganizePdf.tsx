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
import {
  Copy,
  Download,
  PenLine,
  Redo2,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dropzone } from '../../components/Dropzone'
import { Intake } from '../../components/Intake'
import { Workspace, WorkspaceButton, WorkspaceError } from '../Workspace'
import { buildPdf, downloadBlob } from '../../lib/pdf/export'
import {
  EncryptedPdfError,
  loadPdf,
  renderPageAtWidth,
  renderPageBytes,
  renderThumbnail,
  thumbnailEdgeFor,
  type LoadedPdf,
} from '../../lib/pdf/pdfjs'
import { PageCard, type PageItem } from './PageCard'
import { FocusPane } from '../../components/FocusPane'
import { PageEditor } from './PageEditor'
import { AnnotationPreview } from './AnnotationPreview'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FileNameField, cleanFileName } from '../../components/FileNameField'
import { Residency, formatBytes } from '../../components/Residency'
import type { AnnotationMap } from '../../lib/pdf/annotations'
import type { RasterMap } from '../../lib/pdf/export'
import { planGrid } from '../../lib/layout'

let seq = 0
const nextId = () => `p${seq++}`

type History = {
  past: PageItem[][]
  present: PageItem[]
  future: PageItem[][]
}

const EMPTY_HISTORY: History = { past: [], present: [], future: [] }

const freshPages = (count: number): PageItem[] =>
  Array.from({ length: count }, (_, i) => ({ id: nextId(), source: i, rotation: 0 }))

export function OrganizePdf() {
  const [doc, setDoc] = useState<(LoadedPdf & { name: string }) | null>(null)
  // Undo history lives in one atomic value. Nesting setState calls inside
  // another setter's updater breaks under StrictMode, which invokes updaters
  // twice — the history would gain phantom entries and renders could loop.
  const [hist, setHist] = useState<History>(EMPTY_HISTORY)
  const pages = hist.present
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // The page shown large in the focus panel — whichever you touched last.
  const [focusId, setFocusId] = useState<string | null>(null)
  // Text, covers, signatures and images placed on pages, keyed by page id.
  const [annotations, setAnnotations] = useState<AnnotationMap>({})
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  // Pages the user asked to rasterise on export.
  const [flattened, setFlattened] = useState<Set<string>>(new Set())
  // Actions that throw work away ask first.
  const [confirming, setConfirming] = useState<'reset' | 'clear' | null>(null)
  // What the download will be called; seeded from the file that was opened.
  const [outName, setOutName] = useState('document')
  const [status, setStatus] = useState<'empty' | 'loading' | 'ready'>('empty')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const anchor = useRef<string | null>(null)
  const renderToken = useRef<object>({})
  // Mirrors of state that the stable clearAll callback needs for teardown.
  // Synced in an effect rather than during render, which React forbids.
  const thumbsRef = useRef(thumbs)
  const docRef = useRef(doc)
  useEffect(() => {
    thumbsRef.current = thumbs
  }, [thumbs])
  useEffect(() => {
    docRef.current = doc
  }, [doc])

  /* ── lifecycle ─────────────────────────────────────────── */

  const clearAll = useCallback(() => {
    renderToken.current = {}
    Object.values(thumbsRef.current).forEach(URL.revokeObjectURL)
    void docRef.current?.doc.loadingTask.destroy()
    setDoc(null)
    setHist(EMPTY_HISTORY)
    setAnnotations({})
    setEditingPageId(null)
    setFlattened(new Set())
    setThumbs({})
    setSelected(new Set())
    setStatus('empty')
    setError(null)
    setBusy(null)
  }, [])

  useEffect(() => clearAll, [clearAll])

  const open = useCallback(
    async (file: File) => {
      clearAll()
      setStatus('loading')
      setError(null)

      let loaded: LoadedPdf
      try {
        loaded = await loadPdf(file)
      } catch (err) {
        setStatus('empty')
        setError(
          err instanceof EncryptedPdfError
            ? 'This PDF is password protected. Remove the password in your PDF reader, then try again.'
            : 'That file could not be read as a PDF. It may be damaged.',
        )
        return
      }

      const token = {}
      renderToken.current = token

      setDoc({ ...loaded, name: file.name })
      setOutName(cleanFileName(file.name))
      setHist({ past: [], present: freshPages(loaded.pageCount), future: [] })
      setStatus('ready')

      // Progressive, so a long document is usable before the last page draws.
      const edge = thumbnailEdgeFor(loaded.pageCount)
      for (let i = 1; i <= loaded.pageCount; i++) {
        if (renderToken.current !== token) return
        try {
          const url = await renderThumbnail(loaded.doc, i, edge)
          if (renderToken.current !== token) {
            URL.revokeObjectURL(url)
            return
          }
          setThumbs((t) => ({ ...t, [i - 1]: url }))
        } catch (err) {
          // One unrenderable page shouldn't stop the rest, but don't hide it.
          console.warn(`Folio: could not render page ${i}`, err)
        }
      }
    },
    [clearAll],
  )

  /* ── edits ─────────────────────────────────────────────── */

  const commit = useCallback((next: PageItem[]) => {
    setHist((h) => ({ past: [...h.past.slice(-49), h.present], present: next, future: [] }))
  }, [])

  const undo = useCallback(() => {
    setHist((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    )
  }, [])

  const redo = useCallback(() => {
    setHist((h) =>
      h.future.length
        ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
        : h,
    )
  }, [])

  const targets = useCallback(
    (id?: string) => (id ? [id] : pages.filter((p) => selected.has(p.id)).map((p) => p.id)),
    [pages, selected],
  )

  const rotate = useCallback(
    (dir: 1 | -1, id?: string) => {
      const ids = new Set(targets(id))
      if (!ids.size) return
      commit(
        pages.map((p) => (ids.has(p.id) ? { ...p, rotation: (p.rotation + dir * 90 + 360) % 360 } : p)),
      )
    },
    [commit, pages, targets],
  )

  const duplicate = useCallback(
    (id?: string) => {
      const ids = new Set(targets(id))
      if (!ids.size) return
      const next: PageItem[] = []
      const carried: AnnotationMap = {}
      for (const p of pages) {
        next.push(p)
        if (ids.has(p.id)) {
          const copyId = nextId()
          next.push({ ...p, id: copyId })
          const marks = annotations[p.id]
          if (marks?.length) carried[copyId] = marks.map((m) => ({ ...m }))
        }
      }
      if (Object.keys(carried).length) setAnnotations((a) => ({ ...a, ...carried }))
      commit(next)
    },
    [annotations, commit, pages, targets],
  )

  const remove = useCallback(
    (id?: string) => {
      const ids = new Set(targets(id))
      if (!ids.size) return
      commit(pages.filter((p) => !ids.has(p.id)))
      setAnnotations((a) => {
        const next = { ...a }
        ids.forEach((id) => delete next[id])
        return next
      })
      setSelected((s) => {
        const n = new Set(s)
        ids.forEach((i) => n.delete(i))
        return n
      })
    },
    [commit, pages, targets],
  )

  const reset = useCallback(() => {
    if (!doc) return
    commit(freshPages(doc.pageCount))
    setSelected(new Set())
  }, [commit, doc])

  /* ── selection ─────────────────────────────────────────── */

  const toggle = useCallback(
    (id: string, additive: boolean, range: boolean) => {
      const from = range && anchor.current ? pages.findIndex((p) => p.id === anchor.current) : -1
      const to = pages.findIndex((p) => p.id === id)
      const isRange = from > -1 && to > -1

      setSelected((s) => {
        const next = new Set(s)
        if (isRange) {
          const [lo, hi] = from < to ? [from, to] : [to, from]
          for (let i = lo; i <= hi; i++) next.add(pages[i].id)
        } else if (additive) {
          if (next.has(id)) next.delete(id)
          else next.add(id)
        } else if (next.size === 1 && next.has(id)) {
          next.clear()
        } else {
          next.clear()
          next.add(id)
        }
        return next
      })

      setFocusId(id)

      // Keep the anchor across a shift-range so the range can be extended.
      if (!isRange) anchor.current = id
    },
    [pages],
  )

  const selectAll = useCallback(() => setSelected(new Set(pages.map((p) => p.id))), [pages])

  /* ── export ────────────────────────────────────────────── */

  const save = useCallback(
    async (onlySelected: boolean) => {
      if (!doc) return
      const chosen = onlySelected ? pages.filter((p) => selected.has(p.id)) : pages
      if (!chosen.length) return

      setBusy(onlySelected ? 'Building selection…' : 'Building PDF…')
      setError(null)
      try {
        const rasters: RasterMap = {}
        const toFlatten = chosen.filter((p) => flattened.has(p.id))
        for (let i = 0; i < toFlatten.length; i++) {
          setBusy(`Flattening page ${i + 1} of ${toFlatten.length}…`)
          rasters[toFlatten[i].id] = await renderPageBytes(doc.doc, toFlatten[i].source + 1)
        }
        setBusy(onlySelected ? 'Building selection…' : 'Building PDF…')
        const blob = await buildPdf(doc.bytes, chosen, annotations, rasters)
        const base = cleanFileName(outName)
        await downloadBlob(blob, onlySelected ? `${base}-selected.pdf` : `${base}.pdf`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed.')
      } finally {
        setBusy(null)
      }
    },
    [annotations, doc, flattened, outName, pages, selected],
  )

  /* ── keyboard ──────────────────────────────────────────── */

  useEffect(() => {
    // The editor overlay owns the keyboard while it is open; without this,
    // Delete would remove the page behind it as well as the selected object.
    if (status !== 'ready' || editingPageId) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAll()
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.size) {
          e.preventDefault()
          remove()
        }
      } else if (e.key === 'Escape') {
        setSelected(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, editingPageId, selectAll, undo, redo, remove, selected.size])

  /* ── drag ──────────────────────────────────────────────── */

  const sensors = useSensors(
    // A small threshold so a click still registers as a click, not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const from = pages.findIndex((p) => p.id === active.id)
      const to = pages.findIndex((p) => p.id === over.id)
      if (from < 0 || to < 0) return
      commit(arrayMove(pages, from, to))
    },
    [commit, pages],
  )

  /* ── render ────────────────────────────────────────────── */

  if (status !== 'ready') {
    return (
      <Workspace title="Edit & rearrange pages">
        {error && <WorkspaceError>{error}</WorkspaceError>}
        <Intake
          does={[
            'Drag pages into a new order.',
            'Rotate, duplicate or delete any page.',
            'Add text, cover something up, or sign it.',
            'Download the whole file, or only the pages you picked.',
          ]}
          limit="Password-protected PDFs cannot be opened. Remove the password in your PDF reader first."
        >
          <Dropzone
            accept="application/pdf,.pdf"
            onFiles={(files) => void open(files[0])}
            title={status === 'loading' ? 'Reading the document' : 'Open a PDF'}
            hint={
              status === 'loading'
                ? 'This is your own machine working. Nothing is being uploaded.'
                : 'Choose a file, or drop one here. It never leaves your device.'
            }
          />
        </Intake>
      </Workspace>
    )
  }

  const editIndex = pages.findIndex((p) => p.id === editingPageId)
  const editPage = editIndex > -1 ? pages[editIndex] : undefined
  const editSize = editPage ? doc?.sizes[editPage.source] : undefined
  // pdf.js already applied the page's own rotation; the user's added rotation
  // turns the display box again.
  const editTurned = editPage ? Math.abs(editPage.rotation % 180) === 90 : false
  const editBox = {
    width: editSize ? (editTurned ? editSize.height : editSize.width) : 595,
    height: editSize ? (editTurned ? editSize.width : editSize.height) : 842,
  }

  const plan = planGrid(pages.length)
  // Fall back to the first page when the focused one has been deleted.
  const focusIndex = Math.max(
    0,
    pages.findIndex((p) => p.id === focusId),
  )
  const focusPage = pages[focusIndex]
  const focusSize = focusPage ? doc?.sizes[focusPage.source] : undefined

  const selectionSize = selected.size

  return (
    <Workspace
      title="Edit & rearrange pages"
      subtitle={
        <Residency
          name={doc?.name ?? 'document.pdf'}
          detail={`${pages.length} page${pages.length === 1 ? '' : 's'} · ${formatBytes(
            doc?.bytes.byteLength ?? 0,
          )} in this tab`}
        />
      }
      active
      onClear={() => setConfirming('clear')}
      busy={busy}
    >
      {error && <WorkspaceError>{error}</WorkspaceError>}

      <div className="sticky top-2 z-30 mb-5 flex flex-wrap items-center gap-1 rounded-[6px] bg-table p-1.5 shadow-[var(--lift-2),var(--rim)]">
        <WorkspaceButton
          onClick={() => focusPage && setEditingPageId(focusPage.id)}
          disabled={!focusPage}
          icon={<PenLine size={15} />}
        >
          Edit page {focusPage ? focusIndex + 1 : ''}
        </WorkspaceButton>

        <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-edge" />

        <WorkspaceButton onClick={() => rotate(-1)} disabled={!selectionSize} icon={<RotateCcw size={15} />}>
          Rotate left
        </WorkspaceButton>
        <WorkspaceButton onClick={() => rotate(1)} disabled={!selectionSize} icon={<RotateCw size={15} />}>
          Rotate right
        </WorkspaceButton>
        <WorkspaceButton onClick={() => duplicate()} disabled={!selectionSize} icon={<Copy size={15} />}>
          Duplicate
        </WorkspaceButton>
        <WorkspaceButton onClick={() => remove()} disabled={!selectionSize} icon={<Trash2 size={15} />}>
          Delete
        </WorkspaceButton>
        <WorkspaceButton
          onClick={() => void save(true)}
          disabled={!selectionSize}
          icon={<Scissors size={15} />}
        >
          {selectionSize ? `Download ${selectionSize} selected` : 'Download selected'}
        </WorkspaceButton>

        <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-edge" />

        <WorkspaceButton onClick={undo} disabled={!hist.past.length} icon={<Undo2 size={15} />} iconOnly label="Undo" />
        <WorkspaceButton onClick={redo} disabled={!hist.future.length} icon={<Redo2 size={15} />} iconOnly label="Redo" />

        <div className="ml-auto flex flex-wrap items-center gap-2 pl-2">
          <FileNameField value={outName} onChange={setOutName} />
          <button
            type="button"
            onClick={selectionSize ? () => setSelected(new Set()) : selectAll}
            className="tap rounded-[4px] px-2.5 py-1.5 text-[13.5px] text-ink-quiet transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-table hover:text-ink hover:shadow-[var(--lift-1)]"
          >
            {selectionSize ? `${selectionSize} selected — clear` : 'Select all'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming('reset')}
            className="tap rounded-[4px] px-2.5 py-1.5 text-[13.5px] text-ink-quiet transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-table hover:text-ink hover:shadow-[var(--lift-1)]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void save(false)}
            disabled={!pages.length || !!busy}
            className="tap inline-flex h-9 items-center gap-2 rounded-[4px] bg-accent px-4 text-[13.5px] font-semibold tracking-[-0.005em] text-accent-ink shadow-[var(--lift-1)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:-translate-y-px enabled:hover:shadow-[var(--lift-2)] disabled:pointer-events-none disabled:opacity-40"
          >
            <Download size={15} />
            Download all
          </button>
        </div>
      </div>

      <>
        <div className={plan.focusPanel ? 'grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]' : ''}>
          {plan.focusPanel && (
            <div className="lg:sticky lg:top-20 lg:self-start">
              <FocusPane
                label={focusPage ? `Page ${focusIndex + 1} of ${pages.length}` : 'No page selected'}
                caption={doc?.name}
                src={focusPage ? thumbs[focusPage.source] : undefined}
                rotation={focusPage?.rotation ?? 0}
                aspect={focusSize ? focusSize.width / focusSize.height : 1 / 1.414}
                emptyHint="Click any page to see it at full size here."
                overlay={
                  focusPage && annotations[focusPage.id]?.length ? (
                    <AnnotationPreview
                      annotations={annotations[focusPage.id]}
                      boxWidth={
                        focusSize
                          ? Math.abs(focusPage.rotation % 180) === 90
                            ? focusSize.height
                            : focusSize.width
                          : 595
                      }
                    />
                  ) : undefined
                }
                actions={
                  focusPage && (
                    <>
                      <WorkspaceButton
                        onClick={() => setEditingPageId(focusPage.id)}
                        icon={<PenLine size={15} />}
                      >
                        Edit
                      </WorkspaceButton>
                      <WorkspaceButton
                        onClick={() => rotate(-1, focusPage.id)}
                        icon={<RotateCcw size={15} />}
                      >
                        Left
                      </WorkspaceButton>
                      <WorkspaceButton
                        onClick={() => rotate(1, focusPage.id)}
                        icon={<RotateCw size={15} />}
                      >
                        Right
                      </WorkspaceButton>
                      <WorkspaceButton
                        onClick={() => duplicate(focusPage.id)}
                        icon={<Copy size={15} />}
                      >
                        Duplicate
                      </WorkspaceButton>
                      <WorkspaceButton
                        onClick={() => remove(focusPage.id)}
                        icon={<Trash2 size={15} />}
                      >
                        Delete
                      </WorkspaceButton>
                    </>
                  )
                }
              />
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className={`table-plane grid gap-4 p-4 sm:gap-5 sm:p-5 ${plan.columns} ${plan.maxWidth}`}>
                {pages.map((page, i) => {
                  const size = doc?.sizes[page.source]
                  return (
                    <PageCard
                      key={page.id}
                      page={page}
                      index={i}
                      thumb={thumbs[page.source]}
                      aspect={size ? size.width / size.height : 1 / 1.414}
                      selected={selected.has(page.id)}
                      focused={plan.focusPanel && page.id === focusPage?.id}
                      onToggle={toggle}
                      onRotate={(id) => rotate(1, id)}
                      onDuplicate={(id) => duplicate(id)}
                      onDelete={(id) => remove(id)}
                      onEdit={setEditingPageId}
                      marks={annotations[page.id]}
                      boxWidth={
                        size
                          ? Math.abs(page.rotation % 180) === 90
                            ? size.height
                            : size.width
                          : 595
                      }
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </>

      {!pages.length && (
        <p className="recess rounded-[6px] py-16 text-center text-[14px] text-ink-quiet">
          Every page has been deleted. Use Reset to bring them all back.
        </p>
      )}

      {confirming === 'reset' && (
        <ConfirmDialog
          title="Reset every page?"
          body={`This puts all ${doc?.pageCount ?? 0} pages back in their original order and undoes every rotation, deletion and duplication. Anything you added in the editor stays.`}
          confirmLabel="Reset pages"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null)
            reset()
          }}
        />
      )}

      {confirming === 'clear' && (
        <ConfirmDialog
          title="Clear this document?"
          body="The file is removed from memory along with every edit, and nothing is kept. You would need to open it again from your device."
          confirmLabel="Clear everything"
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            setConfirming(null)
            clearAll()
          }}
        />
      )}

      {editPage && (
        <PageEditor
          renderAtWidth={(cssWidth) =>
            renderPageAtWidth(doc!.doc, editPage.source + 1, cssWidth)
          }
          thumb={thumbs[editPage.source]}
          thumbRotation={editPage.rotation}
          boxWidth={editBox.width}
          boxHeight={editBox.height}
          pageLabel={`Page ${editIndex + 1} of ${pages.length}`}
          annotations={annotations[editPage.id] ?? []}
          onChange={(next) => setAnnotations((a) => ({ ...a, [editPage.id]: next }))}
          onClose={() => setEditingPageId(null)}
          onPrev={editIndex > 0 ? () => setEditingPageId(pages[editIndex - 1].id) : undefined}
          onNext={
            editIndex < pages.length - 1
              ? () => setEditingPageId(pages[editIndex + 1].id)
              : undefined
          }
          flattened={flattened.has(editPage.id)}
          onToggleFlatten={() =>
            setFlattened((f) => {
              const next = new Set(f)
              if (next.has(editPage.id)) next.delete(editPage.id)
              else next.add(editPage.id)
              return next
            })
          }
        />
      )}
    </Workspace>
  )
}
