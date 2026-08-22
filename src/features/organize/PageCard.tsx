import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, PenLine, RotateCw, Trash2 } from 'lucide-react'
import { AnnotationPreview } from './AnnotationPreview'
import type { Annotation } from '../../lib/pdf/annotations'

export type PageItem = {
  id: string
  /** 0-based index into the original document. Repeats mean duplicates. */
  source: number
  rotation: number
}

type Props = {
  page: PageItem
  index: number
  thumb?: string
  /** Width / height of the original page, used to size the card. */
  aspect: number
  selected: boolean
  /** Currently shown in the focus panel. */
  focused?: boolean
  onToggle: (id: string, additive: boolean, range: boolean) => void
  onRotate: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  /** Annotations placed on this page, drawn over the thumbnail. */
  marks?: Annotation[]
  /** The page's display width in PDF points, for sizing preview text. */
  boxWidth: number
}

/** A tool that rides on the sheet. Raised, so it reads as sitting on paper. */
function SheetTool({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className={`grid h-7 w-7 place-items-center rounded-[4px] bg-table text-ink-quiet shadow-[var(--lift-1),var(--rim)] transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px ${
        danger ? 'hover:bg-stop hover:text-table' : 'hover:bg-ink hover:text-table'
      }`}
    >
      {children}
    </button>
  )
}

export function PageCard({
  page,
  index,
  thumb,
  aspect,
  selected,
  focused,
  onToggle,
  onRotate,
  onDuplicate,
  onDelete,
  onEdit,
  marks,
  boxWidth,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  })

  const turned = Math.abs(page.rotation % 180) === 90
  const edits = marks?.length ?? 0

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${isDragging ? 'z-20' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Page ${index + 1}${selected ? ', selected' : ''}`}
        onClick={(e) => onToggle(page.id, e.ctrlKey || e.metaKey, e.shiftKey)}
        onDoubleClick={() => onEdit(page.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(page.id, e.ctrlKey || e.metaKey, e.shiftKey)
          }
        }}
        /* A sheet lying on the table. Paper has no outline of its own, so an
           unselected page carries only its shadow; the ring is the mark. */
        className={`sheet relative flex w-full cursor-grab touch-none items-center justify-center overflow-hidden outline-none active:cursor-grabbing ${
          selected ? 'sheet-selected' : focused ? 'sheet-focused' : ''
        } ${isDragging ? 'sheet-dragging' : ''}`}
        style={{ aspectRatio: aspect }}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            draggable={false}
            className="absolute inset-0 m-auto select-none object-contain"
            style={{
              transform: `rotate(${page.rotation}deg)`,
              // Fill the tile rather than sitting at the thumbnail's natural
              // size. A turned page swaps its box, so it takes the tile's
              // other dimension.
              width: turned ? `${100 / aspect}%` : '100%',
              height: turned ? `${100 * aspect}%` : '100%',
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-recess" />
        )}

        {marks?.length ? <AnnotationPreview annotations={marks} boxWidth={boxWidth} /> : null}

        {/* Delete is always to hand; the rest appear once a page is selected,
            so an unselected grid stays a grid rather than a wall of buttons. */}
        <div className="on-hover absolute inset-x-0 bottom-1.5 flex flex-wrap justify-center gap-1">
          {selected && (
            <>
              <SheetTool label={`Edit page ${index + 1}`} onClick={() => onEdit(page.id)}>
                <PenLine size={13} />
              </SheetTool>
              <SheetTool label={`Rotate page ${index + 1}`} onClick={() => onRotate(page.id)}>
                <RotateCw size={13} />
              </SheetTool>
              <SheetTool label={`Duplicate page ${index + 1}`} onClick={() => onDuplicate(page.id)}>
                <Copy size={13} />
              </SheetTool>
            </>
          )}
          <SheetTool label={`Delete page ${index + 1}`} danger onClick={() => onDelete(page.id)}>
            <Trash2 size={13} />
          </SheetTool>
        </div>
      </div>

      {/* Frame numbering, the way a contact sheet carries it: under the frame,
          not floating on top of the picture. */}
      <div className="mt-2 flex items-center justify-center gap-1.5">
        <span
          className={`data inline-flex h-5 min-w-5 items-center justify-center rounded-[3px] px-1 text-[11.5px] font-medium tabular-nums ${
            selected ? 'bg-ink text-table' : 'text-ink-faint'
          }`}
        >
          {index + 1}
        </span>
        {edits > 0 && (
          <span
            className="data inline-flex items-center gap-1 text-[11.5px] text-ink-quiet"
            title={`${edits} edit${edits === 1 ? '' : 's'} on this page`}
          >
            <PenLine size={10} />
            {edits}
          </span>
        )}
      </div>
    </div>
  )
}
