import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../components/ui'
import { navigate } from '../lib/useHashRoute'
import { useIdleClear } from '../lib/useIdleClear'

type Props = {
  /** Retained so callers keep compiling; a screen is not a numbered step. */
  item?: string
  title: string
  /** A string, or the residency readout when a workspace is holding a file. */
  subtitle?: ReactNode
  /** Runs the idle auto-clear. Off while the workspace is empty. */
  active?: boolean
  onClear?: () => void
  busy?: string | null
  children: ReactNode
}

export function Workspace({ title, subtitle, active = false, onClear, busy, children }: Props) {
  const idle = useIdleClear(active, () => onClear?.())

  return (
    <main id="main" className="mx-auto w-full max-w-[100rem] px-5 pb-24 pt-4 sm:px-8">
      <button
        type="button"
        onClick={() => navigate('home')}
        className="tap -ml-1.5 inline-flex items-center gap-1.5 rounded-[4px] px-1.5 text-[13px] text-ink-quiet transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft size={14} />
        All tools
      </button>

      <div className="relative mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-2.5 pb-4">
        <h1 className="display shrink-0 text-[19px] sm:text-[21px]">{title}</h1>

        {typeof subtitle === 'string' ? (
          <p className="min-w-0 truncate text-[13.5px] text-ink-quiet">{subtitle}</p>
        ) : (
          subtitle
        )}

        {active && (
          <div className="ml-auto flex shrink-0 items-center">
            <Button variant="danger" size="sm" onClick={onClear}>
              Clear
            </Button>
          </div>
        )}

        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-edge" />
      </div>

      {idle.warning && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[5px] border border-stop bg-stop-wash px-4 py-3 text-[13.5px]">
          <AlertTriangle size={15} className="shrink-0 text-stop" />
          <span>
            Wiping in <span className="data font-medium text-stop">{idle.label}</span>. Download
            your file if you still need it.
          </span>
          <Button variant="solid" size="sm" className="ml-auto" onClick={idle.keepAlive}>
            Keep working
          </Button>
        </div>
      )}

      {busy && (
        <div className="recess mt-4 flex items-center gap-2.5 rounded-[5px] px-4 py-3 text-[13.5px] text-ink-quiet">
          <Loader2 size={14} className="animate-spin text-signal" />
          {busy}
        </div>
      )}

      <div className="mt-5">{children}</div>
    </main>
  )
}

export function WorkspaceError({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-[5px] border border-stop bg-stop-wash px-4 py-3 text-[13.5px]">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-stop" />
      <span>{children}</span>
    </div>
  )
}

/**
 * A control on the instrument bar. Flat until you point at it, then it lifts
 * to the table's tone — the same rule every other pressable thing follows.
 */
export function WorkspaceButton({
  children,
  onClick,
  disabled,
  icon,
  iconOnly,
  label,
}: {
  children?: ReactNode
  onClick: () => void
  disabled?: boolean
  icon: ReactNode
  iconOnly?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={`tap inline-flex h-9 items-center gap-1.5 rounded-[4px] text-[13.5px] text-ink-quiet transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:-translate-y-px enabled:hover:bg-table enabled:hover:text-ink enabled:hover:shadow-[var(--lift-1)] disabled:pointer-events-none disabled:opacity-30 ${
        iconOnly ? 'w-9 justify-center' : 'px-2.5'
      }`}
    >
      {icon}
      {!iconOnly && children}
    </button>
  )
}
