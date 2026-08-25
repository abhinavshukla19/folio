/**
 * One drawn diagram per slot, showing the transform that tool performs
 * rather than an icon standing in for its name. All three share a stroke
 * weight and a paper fill, so they read as one set of technical drawings.
 *
 * Purely presentational — no props, no state, no behaviour.
 */

const STROKE = 1.4

/** Shared paper: white sheet, quiet outline, softly rounded corner. */
function Sheet({
  x,
  y,
  w,
  h,
  strong,
  transform,
}: {
  x: number
  y: number
  w: number
  h: number
  strong?: boolean
  transform?: string
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1.5}
      transform={transform}
      fill="var(--sheet)"
      stroke="currentColor"
      strokeWidth={STROKE}
      opacity={strong ? 1 : 0.55}
    />
  )
}

/** The line of a page's text, drawn as a rule rather than lorem. */
function Rule({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <line
      x1={x}
      y1={y}
      x2={x + w}
      y2={y}
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      opacity={0.32}
    />
  )
}

function Arrow({ x, y, len = 9 }: { x: number; y: number; len?: number }) {
  return (
    <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" opacity={0.5}>
      <line x1={x} y1={y} x2={x + len} y2={y} />
      <polyline points={`${x + len - 3.2},${y - 3.2} ${x + len},${y} ${x + len - 3.2},${y + 3.2}`} fill="none" />
    </g>
  )
}

const box = 'h-full w-full'

/** Four pages in a row, one lifted out of line and turned. */
export function DiagramRearrange() {
  return (
    <svg viewBox="0 0 76 48" fill="none" className={box} aria-hidden="true">
      <Sheet x={4} y={16} w={13} h={19} />
      <Rule x={7} y={22} w={7} />
      <Rule x={7} y={26} w={5} />

      <Sheet x={21} y={16} w={13} h={19} />
      <Rule x={24} y={22} w={7} />
      <Rule x={24} y={26} w={5} />

      {/* the gap the lifted page came out of */}
      <rect
        x={38}
        y={16}
        width={13}
        height={19}
        rx={1.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeDasharray="2.4 2.6"
        opacity={0.3}
      />

      <Sheet x={55} y={16} w={13} h={19} />
      <Rule x={58} y={22} w={7} />
      <Rule x={58} y={26} w={5} />

      {/* lifted, turned, and carrying the only solid outline */}
      <g transform="rotate(-11 44.5 12)">
        <Sheet x={38} y={2} w={13} h={19} strong />
        <Rule x={41} y={8} w={7} />
        <Rule x={41} y={12} w={5} />
      </g>
    </svg>
  )
}

/** Three photographs collapsing into a single document. */
export function DiagramImages() {
  const photo = (x: number, y: number, o: number) => (
    <g key={`${x}-${y}`} opacity={o}>
      <rect
        x={x}
        y={y}
        width={15}
        height={12}
        rx={1.5}
        fill="var(--sheet)"
        stroke="currentColor"
        strokeWidth={STROKE}
      />
      <circle cx={x + 4.2} cy={y + 4} r={1.5} fill="currentColor" opacity={0.45} />
      <path
        d={`M${x + 1.6} ${y + 10.2} L${x + 5.6} ${y + 6.4} L${x + 8.6} ${y + 8.8} L${x + 11.2} ${y + 6} L${x + 13.4} ${y + 8.2}`}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
      />
    </g>
  )

  return (
    <svg viewBox="0 0 76 48" fill="none" className={box} aria-hidden="true">
      {photo(3, 4, 0.5)}
      {photo(6, 18, 0.75)}
      {photo(9, 32, 1)}

      <Arrow x={31} y={26} />

      <Sheet x={48} y={12} w={17} h={24} strong />
      <Rule x={52} y={19} w={9} />
      <Rule x={52} y={23} w={9} />
      <Rule x={52} y={27} w={6} />
    </svg>
  )
}

/** Crop marks closing in on a photograph. */
export function DiagramCrop() {
  const corner = (x: number, y: number, sx: number, sy: number) => (
    <path
      key={`${x}-${y}`}
      d={`M${x} ${y + 9 * sy} L${x} ${y} L${x + 9 * sx} ${y}`}
      stroke="currentColor"
      strokeWidth={STROKE * 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  )

  return (
    <svg viewBox="0 0 76 48" fill="none" className={box} aria-hidden="true">
      <rect
        x={6}
        y={7}
        width={48}
        height={34}
        rx={2}
        fill="var(--sheet)"
        stroke="currentColor"
        strokeWidth={STROKE}
        opacity={0.45}
      />
      <circle cx={17} cy={17} r={2.6} fill="currentColor" opacity={0.4} />
      <path
        d={`M8 38 L20 26 L28 33 L37 23 L52 38`}
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.4}
      />

      {/* the frame being pulled in from the edges */}
      {corner(20, 2, 1, 1)}
      {corner(70, 2, -1, 1)}
      {corner(20, 46, 1, -1)}
      {corner(70, 46, -1, -1)}
    </svg>
  )
}

/** Two documents becoming one thicker one. */
export function DiagramMerge() {
  return (
    <svg viewBox="0 0 76 48" fill="none" className={box} aria-hidden="true">
      <Sheet x={4} y={3} w={15} h={18} />
      <Rule x={7.5} y={9} w={8} />
      <Rule x={7.5} y={13} w={6} />

      <Sheet x={4} y={27} w={15} h={18} />
      <Rule x={7.5} y={33} w={8} />
      <Rule x={7.5} y={37} w={6} />

      <Arrow x={26} y={24} />

      {/* the back edges are what make the result read as thicker */}
      <Sheet x={51} y={8} w={17} h={24} />
      <Sheet x={48} y={11} w={17} h={24} />
      <Sheet x={45} y={14} w={17} h={24} strong />
      <Rule x={49} y={21} w={9} />
      <Rule x={49} y={25} w={9} />
      <Rule x={49} y={29} w={6} />
    </svg>
  )
}

/**
 * A page seen at an angle, and the same page square. The transform this tool
 * performs is exactly that: the quadrilateral the camera saw, mapped back to
 * the rectangle the paper actually is.
 */
export function DiagramScan() {
  return (
    <svg viewBox="0 0 112 48" fill="none" className={box} aria-hidden="true">
      {/* the page as the camera sees it: converging edges */}
      <path
        d="M8 12 L40 5 L44 41 L11 44 Z"
        fill="var(--sheet)"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
        opacity={0.55}
      />
      <g stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" opacity={0.35}>
        <path d="M14 18 L35 14" />
        <path d="M15 24 L36 20" />
        <path d="M16 30 L31 27" />
      </g>

      {/* the corners being found */}
      <g fill="currentColor">
        <circle cx={8} cy={12} r={2.4} />
        <circle cx={40} cy={5} r={2.4} />
        <circle cx={44} cy={41} r={2.4} />
        <circle cx={11} cy={44} r={2.4} />
      </g>

      <path
        d="M55 24 L67 24 M63 20 L67 24 L63 28"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />

      {/* the page as it actually is */}
      <Sheet x={76} y={6} w={28} h={36} strong />
      <Rule x={81} y={15} w={18} />
      <Rule x={81} y={21} w={18} />
      <Rule x={81} y={27} w={13} />
    </svg>
  )
}
