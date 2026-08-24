import { useRef, useState, type ReactNode } from 'react'

type Props = {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  title: string
  hint: ReactNode
  compact?: boolean
  /** What the slot is waiting for. A photo tool asking for a page is a lie. */
  mark?: 'sheet' | 'picture'
}

/** A sheet, drawn in the same stroke as the slot diagrams on the home screen. */
function SheetMark() {
  return (
    <svg viewBox="0 0 32 40" fill="none" className="h-10 w-8" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="30"
        height="38"
        rx="2.5"
        fill="var(--sheet)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.3">
        <line x1="7" y1="12" x2="25" y2="12" />
        <line x1="7" y1="19" x2="25" y2="19" />
        <line x1="7" y1="26" x2="18" y2="26" />
      </g>
    </svg>
  )
}

/** A picture, in the same stroke: landscape, with a horizon and a sun. */
function PictureMark() {
  return (
    <svg viewBox="0 0 40 32" fill="none" className="h-8 w-10" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="38"
        height="30"
        rx="2.5"
        fill="var(--sheet)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        fill="none"
      >
        <circle cx="11" cy="11" r="2.6" />
        <path d="M3 27 L13 16 L19 22 L26 14 L37 26" />
      </g>
    </svg>
  )
}

export function Dropzone({
  accept,
  multiple = false,
  onFiles,
  title,
  hint,
  compact,
  mark = 'sheet',
}: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  // dragenter/leave fire for every child element; count depth instead of toggling.
  const depth = useRef(0)

  const accepted = accept.split(',').map((t) => t.trim())
  const matches = (f: File) =>
    accepted.some((t) => (t.startsWith('.') ? f.name.toLowerCase().endsWith(t) : f.type === t))

  const take = (list: FileList | null) => {
    if (!list) return
    const files = Array.from(list).filter(matches)
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        depth.current += 1
        setOver(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault()
        depth.current -= 1
        if (depth.current <= 0) {
          depth.current = 0
          setOver(false)
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setOver(false)
        take(e.dataTransfer.files)
      }}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          input.current?.click()
        }
      }}
      /* A slot cut into the table, not a box drawn on it. Light spills in when
         you point at it; when a file is actually over it, the safelight comes
         on, because something is about to become resident. */
      className={`slot recess flex cursor-pointer flex-col items-center justify-center rounded-[6px] text-center ${
        over ? 'slot-armed' : ''
      } ${compact ? 'px-5 py-8' : 'h-full px-5 py-14 sm:py-16'}`}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          take(e.target.files)
          e.target.value = '' // let the same file be picked again after a clear
        }}
      />

      {!compact && (
        <span className={`mb-5 block ${over ? 'text-signal' : 'text-ink-faint'}`}>
          {mark === 'picture' ? <PictureMark /> : <SheetMark />}
        </span>
      )}

      <p className={`font-semibold tracking-[-0.01em] ${compact ? 'text-[14px]' : 'text-[17px]'}`}>
        {title}
      </p>
      <p className="mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-quiet">{hint}</p>
    </div>
  )
}
