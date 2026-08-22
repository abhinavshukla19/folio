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
