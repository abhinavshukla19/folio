import { Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

type Props = {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  title: string
  hint: ReactNode
  compact?: boolean
}

export function Dropzone({ accept, multiple = false, onFiles, title, hint, compact }: Props) {
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
      className={`flex flex-col items-center justify-center rounded-part border-2 border-dashed text-center transition-colors duration-200 ${
        over ? 'border-violet bg-violet-wash' : 'border-[var(--hairline-strong)] bg-surface'
      } ${compact ? 'px-6 py-10' : 'px-6 py-24 sm:py-32'}`}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          take(e.target.files)
          e.target.value = '' // let the same file be picked again after a clear
        }}
      />

      <span
        className={`grid place-items-center rounded-full bg-violet-wash text-violet ${
          compact ? 'h-11 w-11' : 'h-14 w-14'
        }`}
      >
        <Upload size={compact ? 18 : 22} />
      </span>

      <h2 className={`font-bold tracking-[-0.02em] ${compact ? 'mt-4 text-[16px]' : 'mt-6 text-[20px]'}`}>
        {title}
      </h2>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-body">{hint}</p>

      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-6 inline-flex h-11 items-center rounded-control bg-violet px-6 text-[14px] font-semibold text-violet-ink transition-colors duration-200 hover:bg-violet-press"
      >
        Choose {multiple ? 'files' : 'file'}
      </button>
    </div>
  )
}
