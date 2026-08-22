import type { ReactNode } from 'react'
import { Reveal } from './Reveal'

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-6 sm:px-8 ${className}`}>{children}</div>
}

/**
 * A section of the prospectus. The heading sits above its content at a
 * generous remove — the plate is spacious, and space is the main material
 * after the ink.
 */
export function Section({
  id,
  title,
  lead,
  children,
  className = '',
}: {
  id?: string
  title: ReactNode
  lead?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`scroll-mt-24 py-20 sm:py-28 ${className}`}>
      <Container>
        <Reveal className="max-w-2xl">
          <h2 className="display text-[2rem] sm:text-[2.6rem]">{title}</h2>
          {lead && <p className="mt-4 text-[17px] leading-relaxed text-body">{lead}</p>}
        </Reveal>
        <Reveal delay={80} className="mt-12">
          {children}
        </Reveal>
      </Container>
    </section>
  )
}

type ButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'quiet'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  title?: string
  'aria-label'?: string
}

const SIZES = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-[14px] gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2.5',
}

const VARIANTS = {
  primary:
    'bg-violet text-violet-ink border border-violet hover:bg-violet-press hover:border-violet-press',
  secondary: 'bg-surface text-violet border border-violet hover:bg-violet-wash',
  quiet: 'text-body border border-transparent hover:text-ink hover:bg-violet-wash',
}

export function Button({
  children,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const cls = `group inline-flex select-none items-center justify-center rounded-control font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-40 ${SIZES[size]} ${VARIANTS[variant]} ${className}`

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

/** A labelled reading, as the prospectus sets them: small-caps label, figure below. */
export function Stat({
  label,
  value,
  status,
  className = '',
}: {
  label: string
  value: ReactNode
  status?: 'positive' | 'caution'
  className?: string
}) {
  return (
    <div className={`p-5 ${className}`}>
      <div className="label">{label}</div>
      <div className="mt-3 flex items-center gap-2">
        <span className="figure text-[28px] leading-none">{value}</span>
        {status && (
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'positive' ? 'bg-positive' : 'bg-caution'
            }`}
          />
        )}
      </div>
    </div>
  )
}
