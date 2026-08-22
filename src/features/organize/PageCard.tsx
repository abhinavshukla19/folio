import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, Copy, PenLine, RotateCw, Trash2 } from 'lucide-react'
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

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
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
      className="grid h-7 w-7 place-items-center rounded-full bg-surface text-body shadow-[var(--shadow-card)] ring-1 ring-[var(--hairline)] transition-colors duration-150 hover:bg-violet hover:text-violet-ink"
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
        className={`hoverable relative flex w-full cursor-grab touch-none items-center justify-center overflow-hidden rounded-[8px] bg-page outline-none ring-1 active:cursor-grabbing ${
          selected
            ? 'ring-2 ring-violet'
            : focused
              ? 'ring-2 ring-[var(--violet-press)]'
              : 'ring-[var(--hairline-strong)]'
        }`}
        style={{
          aspectRatio: aspect,
          boxShadow: isDragging ? 'var(--shadow-lift)' : undefined,
        }}
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
          <div className="absolute inset-0 bg-plate-deep" />
        )}

        {marks?.length ? <AnnotationPreview annotations={marks} boxWidth={boxWidth} /> : null}
      </div>

      <span className="pointer-events-none absolute -left-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-surface px-1 text-[10px] font-bold text-muted shadow-[var(--shadow-card)] ring-1 ring-[var(--hairline)]">
        {index + 1}
      </span>

      {selected && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-violet text-violet-ink">
          <Check size={11} strokeWidth={3} />
        </span>
      )}

      {(marks?.length ?? 0) > 0 && !selected && (
        <span
          className="pointer-events-none absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-violet px-1 text-[10px] font-bold text-violet-ink"
          title={`${marks?.length} edit${marks?.length === 1 ? '' : 's'} on this page`}
        >
          {marks?.length}
        </span>
      )}

      {/* Delete is always to hand; the rest appear once a page is selected,
          so an unselected grid stays a grid rather than a wall of buttons. */}
      <div className="on-hover absolute inset-x-0 bottom-1.5 flex flex-wrap justify-center gap-1">
        {selected && (
          <>
            <IconButton label={`Edit page ${index + 1}`} onClick={() => onEdit(page.id)}>
              <PenLine size={12} />
            </IconButton>
            <IconButton label={`Rotate page ${index + 1}`} onClick={() => onRotate(page.id)}>
              <RotateCw size={12} />
            </IconButton>
            <IconButton label={`Duplicate page ${index + 1}`} onClick={() => onDuplicate(page.id)}>
              <Copy size={12} />
            </IconButton>
          </>
        )}
        <IconButton label={`Delete page ${index + 1}`} onClick={() => onDelete(page.id)}>
          <Trash2 size={12} />
        </IconButton>
      </div>
    </div>
  )
}
