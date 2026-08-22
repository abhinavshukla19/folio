import { Check, Copy, Download, RotateCw, Scissors, Trash2 } from 'lucide-react'

/** Page thumbnails stay paper-white in both themes — that is what a page is. */
function Sheet({ lines = 5, rotated = false }: { lines?: number; rotated?: boolean }) {
  return (
    <div
      className="h-full w-full rounded-[4px] bg-page p-2.5"
      style={rotated ? { transform: 'rotate(90deg) scale(0.72)' } : undefined}
    >
      <div className="mb-2 h-1.5 w-2/3 rounded-full bg-[var(--page-line)]" />
      <div className="space-y-1.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-[3px] rounded-full bg-[var(--page-line)] opacity-70"
            style={{ width: `${94 - ((i * 17) % 42)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function Page({ n, selected, rotated }: { n: number; selected?: boolean; rotated?: boolean }) {
  return (
    <div
      className={`relative aspect-[1/1.414] rounded-[6px] bg-page p-1 ring-1 ${
        selected ? 'ring-2 ring-violet' : 'ring-[var(--hairline-strong)]'
      }`}
    >
      <Sheet lines={4 + (n % 3)} rotated={rotated} />
      <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-surface text-[10px] font-bold text-muted ring-1 ring-[var(--hairline)]">
        {n}
      </span>
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-violet text-violet-ink">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
    </div>
  )
}

function Tool({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-control border border-hairline px-2.5 py-1.5 text-[11px] font-semibold text-body">
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

/** A non-interactive picture of the editor. */
export function PagePreview() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <span className="text-[14px] font-semibold">contract-scan.pdf</span>
        <span className="flex items-center gap-4">
          <span className="text-[13px] text-muted">12 pages</span>
          <span className="figure rounded-control bg-violet-wash px-2.5 py-1 text-[13px] text-violet-press">
            9:41
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3">
        <Tool icon={<RotateCw size={12} />} label="Rotate" />
        <Tool icon={<Copy size={12} />} label="Duplicate" />
        <Tool icon={<Trash2 size={12} />} label="Delete" />
        <Tool icon={<Scissors size={12} />} label="Extract" />
        <span className="ml-auto text-[12px] font-semibold text-violet">2 selected</span>
      </div>

      <div className="grid grid-cols-4 gap-4 p-5 sm:grid-cols-6">
        <Page n={1} />
        <Page n={2} selected />
        <Page n={3} />
        <Page n={4} rotated />
        <Page n={5} selected />
        <Page n={6} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-3.5">
        <span className="text-[12px] text-muted">0 bytes sent to a server</span>
        <span className="inline-flex items-center gap-2 rounded-control bg-violet px-3.5 py-2 text-[12px] font-semibold text-violet-ink">
          <Download size={13} />
          Download
        </span>
      </div>
    </div>
  )
}
