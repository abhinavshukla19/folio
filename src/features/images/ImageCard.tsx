import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { RotateCw, Trash2 } from 'lucide-react'

export type ImageItem = {
  id: string
  file: File
  url: string
  rotation: number
}

type Props = {
  item: ImageItem
  index: number
  /** Currently shown in the focus panel. */
  focused?: boolean
  onSelect?: (id: string) => void
  onRotate: (id: string) => void
  onDelete: (id: string) => void
}

export function ImageCard({ item, index, focused, onSelect, onRotate, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative ${isDragging ? 'z-20' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        onClick={() => onSelect?.(item.id)}
        className={`relative flex aspect-square w-full cursor-grab touch-none items-center justify-center overflow-hidden rounded-[8px] bg-sheet p-2 ring-1 active:cursor-grabbing ${
          focused ? 'ring-2 ring-ink' : 'ring-[var(--line-strong)]'
        }`}
        style={{ boxShadow: isDragging ? 'var(--shadow-lift)' : undefined }}
      >
        <img
          src={item.url}
          alt=""
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{ transform: `rotate(${item.rotation}deg)` }}
        />
      </div>

      <span className="data pointer-events-none absolute -left-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-[3px] bg-table px-1 text-[10.5px] font-medium text-ink-faint shadow-[var(--lift-1)]">
        {index + 1}
      </span>

      <div className="on-hover absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {[
          { label: 'Rotate', icon: <RotateCw size={12} />, run: () => onRotate(item.id) },
          { label: 'Remove', icon: <Trash2 size={12} />, run: () => onDelete(item.id) },
        ].map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={`${action.label} image ${index + 1}`}
            title={action.label}
            onClick={(e) => {
              e.stopPropagation()
              action.run()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="grid h-7 w-7 place-items-center rounded-[4px] bg-table text-ink-quiet shadow-[var(--lift-1),var(--rim)] transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-ink hover:text-table"
          >
            {action.icon}
          </button>
        ))}
      </div>

      <p className="mt-2 truncate text-center text-[11.5px] text-ink-quiet" title={item.file.name}>
        {item.file.name}
      </p>
    </div>
  )
}
