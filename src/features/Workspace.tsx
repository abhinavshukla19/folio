import { AlertTriangle, ArrowLeft, Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Container } from '../components/ui'
import { navigate } from '../lib/useHashRoute'
import { useIdleClear } from '../lib/useIdleClear'

type Props = {
  item: string
  title: string
  subtitle?: string
  /** Runs the idle auto-clear. Off while the workspace is empty. */
  active?: boolean
  onClear?: () => void
  busy?: string | null
  children: ReactNode
}

export function Workspace({ item, title, subtitle, active = false, onClear, busy, children }: Props) {
  const idle = useIdleClear(active, () => onClear?.())

  return (
    <div className="pb-24 pt-10">
      <Container className="max-w-[92rem]">
        <button
          type="button"
          onClick={() => navigate('home')}
          className="u-draw mb-8 inline-flex items-center gap-2 text-[14px] font-medium text-body transition-colors duration-200 hover:text-violet"
        >
          <ArrowLeft size={15} />
          All tools
        </button>

        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <span className="label">Tool {item}</span>
            <h1 className="display mt-2 text-[2rem] sm:text-[2.4rem]">{title}</h1>
            {subtitle && <p className="mt-2 truncate text-[15px] text-body">{subtitle}</p>}
          </div>

          {active && (
            <div className="flex items-center gap-2">
              <span
                className="figure rounded-control bg-violet-wash px-3.5 py-2 text-[14px] text-violet-press"
                title="Your file is cleared from memory after ten minutes without activity"
              >
                Clears in {idle.label}
              </span>
              <button
                type="button"
                onClick={onClear}
                className="tap inline-flex h-10 items-center gap-1.5 rounded-control border border-hairline px-3.5 text-[13px] font-semibold text-body transition-colors duration-200 hover:border-caution hover:text-caution"
              >
                <X size={14} />
                Clear
              </button>
            </div>
          )}
        </div>

        {idle.warning && (
          <div className="mt-5 flex flex-wrap items-center gap-3 rounded-part border border-caution bg-caution-wash px-5 py-4 text-[14px]">
            <AlertTriangle size={16} className="text-caution" />
            <span>
              Clearing in <span className="figure text-caution">{idle.label}</span>. Download your
              file if you still need it.
            </span>
            <button
              type="button"
              onClick={idle.keepAlive}
              className="ml-auto rounded-control bg-violet px-4 py-2 text-[13px] font-semibold text-violet-ink transition-colors duration-200 hover:bg-violet-press"
            >
              Keep working
            </button>
          </div>
        )}

        {busy && (
          <div className="card mt-5 flex items-center gap-2.5 px-5 py-4 text-[14px] text-body">
            <Loader2 size={15} className="animate-spin text-violet" />
            {busy}
          </div>
        )}

        <div className="mt-6">{children}</div>
      </Container>
    </div>
  )
}

export function WorkspaceError({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-part border border-caution bg-caution-wash px-5 py-4 text-[14px]">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-caution" />
      <span className="text-ink">{children}</span>
    </div>
  )
}

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
      className={`inline-flex h-9 items-center gap-2 rounded-control border border-transparent text-[13px] font-semibold text-body transition-colors duration-200 hover:bg-violet-wash hover:text-violet disabled:pointer-events-none disabled:opacity-35 ${
        iconOnly ? 'w-9 justify-center' : 'px-3'
      }`}
    >
      {icon}
      {!iconOnly && children}
    </button>
  )
}
