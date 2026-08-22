type Props = {
  size?: number
  withWordmark?: boolean
  className?: string
}

/** Two leaves, offset — the front one inked violet. Flat, geometric, no gradient. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="7.5" y="3" width="13" height="17" rx="3" fill="currentColor" opacity="0.2" />
      <rect x="3.5" y="5" width="13" height="17" rx="3" fill="var(--violet)" />
    </svg>
  )
}

export function Logo({ size = 22, withWordmark = true, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="font-extrabold tracking-[-0.02em]" style={{ fontSize: size * 0.86 }}>
          Folio
        </span>
      )}
    </span>
  )
}
