type Props = {
  size?: number
  withWordmark?: boolean
  className?: string
}

/**
 * A sheet lying on the one behind it, drawn in the same stroke and paper fill
 * as the slot diagrams so the mark belongs to the same set of drawings.
 */
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="8.6"
        y="2.8"
        width="12.6"
        height="16.6"
        rx="1.8"
        fill="var(--sheet)"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.42"
      />
      <rect
        x="2.8"
        y="4.6"
        width="12.6"
        height="16.6"
        rx="1.8"
        fill="currentColor"
      />
    </svg>
  )
}

export function Logo({ size = 20, withWordmark = true, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="display" style={{ fontSize: size * 0.95 }}>
          Folio
        </span>
      )}
    </span>
  )
}
