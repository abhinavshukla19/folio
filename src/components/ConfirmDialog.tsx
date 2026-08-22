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
      className="fixed inset-0 z-[80] grid place-items-center bg-[rgb(9_9_11/0.55)] p-5"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm p-6"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-caution-wash text-caution">
            <AlertTriangle size={17} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">{title}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-body">{body}</p>
          </div>
        </div>

        <div ref={confirmRef} className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
