/**
 * The world's signature material: a single ribbon of light, teal through
 * lilac into violet.
 *
 * This is the ONLY gradient in the product. It exists because the chosen
 * visual world is built on it; every other surface stays flat. Decorative,
 * so it is aria-hidden and never carries meaning.
 */
export function Ribbon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`ribbon ${className}`}
      viewBox="0 0 520 720"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="folio-ribbon-a" x1="470" y1="40" x2="120" y2="690" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--ribbon-1)" />
          <stop offset="0.52" stopColor="var(--ribbon-2)" />
          <stop offset="1" stopColor="var(--ribbon-3)" />
        </linearGradient>
        <linearGradient id="folio-ribbon-b" x1="380" y1="0" x2="240" y2="720" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--ribbon-2)" stopOpacity="0.85" />
          <stop offset="1" stopColor="var(--ribbon-3)" stopOpacity="0.35" />
        </linearGradient>
        <filter id="folio-ribbon-soft" x="-30%" y="-10%" width="160%" height="120%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      {/* trailing fold, softened so the form reads as one turning surface */}
      <path
        d="M436 -30C470 150 300 232 214 322C128 412 168 566 292 748"
        stroke="url(#folio-ribbon-b)"
        strokeWidth="120"
        strokeLinecap="round"
        filter="url(#folio-ribbon-soft)"
        opacity="0.5"
      />

      {/* the ribbon proper */}
      <path
        d="M446 -40C486 160 300 246 206 340C112 434 152 588 286 760"
        stroke="url(#folio-ribbon-a)"
        strokeWidth="86"
        strokeLinecap="round"
      />

      {/* the light catching the near edge of the turn */}
      <path
        d="M446 -40C486 160 300 246 206 340"
        stroke="var(--ribbon-1)"
        strokeWidth="16"
        strokeLinecap="round"
        opacity="0.5"
        filter="url(#folio-ribbon-soft)"
      />
    </svg>
  )
}
