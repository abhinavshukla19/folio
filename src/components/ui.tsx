import type { ReactNode } from 'react'

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 ${className}`}>{children}</div>
}

type ButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  variant?: 'solid' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
  title?: string
  'aria-label'?: string
}

const SIZES = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5',
  md: 'h-9 px-4 text-[13.5px] gap-2',
}

/*
 * Nothing pressable is flat here. `solid` is the ink itself, `outline` is a
 * chip raised off whatever plane it sits on, and both rise a little further
 * under the pointer. `ghost` stays flush until pointed at, then joins them.
 */
const VARIANTS = {
  solid:
    'bg-ink text-table shadow-[var(--lift-1)] enabled:hover:-translate-y-px enabled:hover:shadow-[var(--lift-2)]',
  outline:
    'bg-table text-ink shadow-[var(--lift-1),var(--rim)] enabled:hover:-translate-y-px enabled:hover:shadow-[var(--lift-2),var(--rim)]',
  ghost: 'text-ink-quiet enabled:hover:bg-table enabled:hover:text-ink enabled:hover:shadow-[var(--lift-1)]',
  danger:
    'text-ink-quiet enabled:hover:bg-stop-wash enabled:hover:text-stop enabled:hover:shadow-[var(--lift-1)]',
}

export function Button({
  children,
  href,
  onClick,
  variant = 'outline',
  size = 'md',
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const cls = `tap inline-flex select-none items-center justify-center rounded-[4px] font-semibold tracking-[-0.005em] transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:pointer-events-none disabled:opacity-40 ${SIZES[size]} ${VARIANTS[variant]} ${className}`

  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} {...rest}>
      {children}
    </button>
  )
}

/** An icon-only control. Square, quiet, and big enough to hit on a touchscreen. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
  className = '',
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`tap grid h-9 w-9 shrink-0 place-items-center rounded-[4px] text-ink-quiet transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] enabled:hover:-translate-y-px enabled:hover:shadow-[var(--lift-1)] disabled:pointer-events-none disabled:opacity-30 ${
        danger
          ? 'enabled:hover:bg-stop-wash enabled:hover:text-stop'
          : 'enabled:hover:bg-table enabled:hover:text-ink'
      } ${className}`}
    >
      {children}
    </button>
  )
}
