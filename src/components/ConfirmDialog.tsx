import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from './ui'

/**
 * A small confirmation for actions that throw work away. Focus lands on
 * Cancel rather than Confirm — a stray Enter should not be what destroys the
 * work — and Escape or a click outside dismisses it.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    confirmRef.current?.querySelector('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[rgb(6_8_10/0.62)] p-3 sm:p-5"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="table-plane flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col p-5 sm:max-h-[calc(100dvh-2.5rem)] sm:p-6"
      >
        <div className="flex min-h-0 shrink items-start gap-3 overflow-y-auto">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[4px] bg-stop-wash text-stop">
            <AlertTriangle size={17} />
          </span>
          <div>
            <h2 className="display text-[18px]">{title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-quiet">{body}</p>
          </div>
        </div>

        <div ref={confirmRef} className="mt-5 flex shrink-0 flex-wrap justify-end gap-2 sm:mt-6">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="solid" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
