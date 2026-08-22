/**
 * What this tab is holding, stated the same way the ledger states what it has
 * sent. On the home screen every figure is zero; here exactly one of them is
 * not, and that is the only thing on the screen wearing the safelight.
 *
 * Purely presentational — every value is handed to it.
 */

/** Bytes as a person would say them, not as a machine would. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1000) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

export function Residency({
  name,
  detail,
}: {
  /** The file being held. */
  name: string
  /** Its size and shape, already formatted — e.g. "4 pages · 2.1 MB". */
  detail: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="size-[7px] shrink-0 rounded-full bg-signal-fill"
      />
      <span className="truncate text-[14px] font-semibold tracking-[-0.005em]">{name}</span>
      <span className="data hidden shrink-0 text-[12.5px] text-ink-quiet sm:inline">{detail}</span>
    </span>
  )
}
