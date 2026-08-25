/**
 * Finding the page in the photograph.
 *
 * This is a classical pipeline, not a trained model: gradients, then a Hough
 * transform, then the best rectangle the lines agree on. It is worth being
 * plain about what that buys and what it does not. A sheet of paper on a
 * contrasting surface is found reliably. A page on a desk of the same tone, or
 * one lying on a patterned cloth, is not — and rather than guess, this returns
 * null and lets the caller fall back to the whole frame with corners the
 * person can drag.
 *
 * Everything runs on a downscaled copy. Detection does not need the detail,
 * and the smaller image suppresses paper texture that would otherwise light up
 * the gradient as strongly as the edge does.
 */

export type Point = { x: number; y: number }

/** Clockwise from the top left. */
export type Quad = [Point, Point, Point, Point]

/** Long edge of the image detection actually looks at. */
const WORK = 480

/**
 * How much of the gradient is allowed to vote. Kept deliberately generous:
 * the edge of a page in shadow is far weaker than the same edge in light, and
 * a tight cut loses the shadowed side entirely. The noise that comes in with
 * it is thrown out later, by scoring whole shapes rather than single lines.
 */
const EDGE_PERCENTILE = 0.85

type Line = { theta: number; rho: number; votes: number }

/* ── the small greyscale copy ─────────────────────────────────── */

function downscale(bitmap: ImageBitmap) {
  const scale = Math.min(1, WORK / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  canvas.width = 0
  canvas.height = 0

  const grey = new Float32Array(w * h)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    grey[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return { grey, w, h, scale }
}

/** A 3x3 box blur, run separably. Cheap, and enough to quiet the grain. */
function blur(src: Float32Array, w: number, h: number) {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = src[y * w + Math.max(0, x - 1)]
      const c = src[y * w + x]
      const r = src[y * w + Math.min(w - 1, x + 1)]
      tmp[y * w + x] = (l + c + r) / 3
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tmp[Math.max(0, y - 1) * w + x]
      const c = tmp[y * w + x]
      const b = tmp[Math.min(h - 1, y + 1) * w + x]
      out[y * w + x] = (t + c + b) / 3
    }
  }
  return out
}

/** Sobel magnitude. Direction is not needed: Hough recovers the angle. */
function gradient(src: Float32Array, w: number, h: number) {
  const mag = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const tl = src[i - w - 1]
      const tc = src[i - w]
      const tr = src[i - w + 1]
      const ml = src[i - 1]
      const mr = src[i + 1]
      const bl = src[i + w - 1]
      const bc = src[i + w]
      const br = src[i + w + 1]
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl)
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr)
      mag[i] = Math.hypot(gx, gy)
    }
  }
  return mag
}

/** The magnitude above which a pixel is allowed to vote. */
function threshold(mag: Float32Array) {
  const sorted = Float32Array.from(mag).sort()
  return sorted[Math.floor(sorted.length * EDGE_PERCENTILE)] || 0
}

/* ── lines ────────────────────────────────────────────────────── */

const THETAS = 180

/**
 * Every strong pixel votes for each line that could pass through it. The
 * cells that collect the most votes are the straight edges in the picture,
 * which for a photographed document are the four sides of the page.
 */
function hough(mag: Float32Array, w: number, h: number, cut: number) {
  const diag = Math.ceil(Math.hypot(w, h))
  const rhos = diag * 2 + 1
  const acc = new Int32Array(THETAS * rhos)

  const cos = new Float32Array(THETAS)
  const sin = new Float32Array(THETAS)
  for (let t = 0; t < THETAS; t++) {
    const a = (t * Math.PI) / THETAS
    cos[t] = Math.cos(a)
    sin[t] = Math.sin(a)
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mag[y * w + x] < cut) continue
      for (let t = 0; t < THETAS; t++) {
        const rho = Math.round(x * cos[t] + y * sin[t]) + diag
        acc[t * rhos + rho]++
      }
    }
  }
  return { acc, rhos, diag }
}

/**
 * Pull the peaks out, suppressing anything too close to one already taken.
 * Without that, a single thick edge returns as a dozen near-identical lines
 * and crowds out the other three sides of the page.
 */
function peaks(
  acc: Int32Array,
  rhos: number,
  diag: number,
  minVotes: number,
  spanTheta: number,
  spanRho: number,
  want: number,
): Line[] {
  const found: Line[] = []
  const taken = new Uint8Array(acc.length)

  for (let n = 0; n < want; n++) {
    let best = -1
    let bestAt = -1
    for (let i = 0; i < acc.length; i++) {
      if (!taken[i] && acc[i] > best) {
        best = acc[i]
        bestAt = i
      }
    }
    if (bestAt < 0 || best < minVotes) break

    const t = Math.floor(bestAt / rhos)
    const r = bestAt % rhos
    found.push({ theta: (t * Math.PI) / THETAS, rho: r - diag, votes: best })

    for (let dt = -spanTheta; dt <= spanTheta; dt++) {
      // Angles wrap: 179 degrees and 0 degrees are neighbours.
      const tt = (t + dt + THETAS) % THETAS
      for (let dr = -spanRho; dr <= spanRho; dr++) {
        const rr = r + dr
        if (rr < 0 || rr >= rhos) continue
        taken[tt * rhos + rr] = 1
      }
    }
  }
  return found
}

/** Where two lines cross, or null if they are near enough to parallel. */
function intersect(a: Line, b: Line): Point | null {
  const det = Math.cos(a.theta) * Math.sin(b.theta) - Math.sin(a.theta) * Math.cos(b.theta)
  if (Math.abs(det) < 1e-6) return null
  return {
    x: (a.rho * Math.sin(b.theta) - b.rho * Math.sin(a.theta)) / det,
    y: (b.rho * Math.cos(a.theta) - a.rho * Math.cos(b.theta)) / det,
  }
}

/** Smallest angle between two undirected lines, in radians. */
function angleBetween(a: number, b: number) {
  const d = Math.abs(a - b) % Math.PI
  return Math.min(d, Math.PI - d)
}

/* ── the quadrilateral ────────────────────────────────────────── */

/** Clockwise from the corner nearest the top left. */
function order(points: Point[]): Quad {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  const round = [...points].sort(
    (p, q) => Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx),
  )
  let first = 0
  let best = Infinity
  round.forEach((p, i) => {
    const d = p.x + p.y
    if (d < best) {
      best = d
      first = i
    }
  })
  return [round[first], round[(first + 1) % 4], round[(first + 2) % 4], round[(first + 3) % 4]]
}

function area(q: Quad) {
  let sum = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

/** Every turn the same way round, so the shape has no crossed sides. */
function convex(q: Quad) {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    const c = q[(i + 2) % 4]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (cross === 0) continue
    const s = cross > 0 ? 1 : -1
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/**
 * A shape only counts as a page if it is convex, covers a real part of the
 * frame, and has no side so short that it was clearly a stray intersection.
 * Rejecting here is the point: a wrong quad silently crops half the document,
 * which is worse than not detecting one at all.
 */
function plausible(q: Quad, w: number, h: number) {
  if (!convex(q)) return false
  if (q.some((p) => p.x < -w * 0.1 || p.x > w * 1.1 || p.y < -h * 0.1 || p.y > h * 1.1)) return false
  if (area(q) < w * h * 0.18) return false
  const min = Math.min(w, h) * 0.15
  for (let i = 0; i < 4; i++) {
    if (Math.hypot(q[i].x - q[(i + 1) % 4].x, q[i].y - q[(i + 1) % 4].y) < min) return false
  }
  return true
}

/**
 * How much of a shape's outline sits on a real edge, from 0 to 1.
 *
 * This is the measure that separates the page from everything else in the
 * picture. Four lines always intersect in a rectangle whether or not that
 * rectangle is a thing; walking its perimeter and asking how much of it the
 * gradient agrees with is what tells the two apart.
 */
function support(mag: Float32Array, w: number, h: number, cut: number, q: Quad) {
  const STEPS = 40
  const NEAR = 2
  let hit = 0
  let total = 0

  for (let side = 0; side < 4; side++) {
    const a = q[side]
    const b = q[(side + 1) % 4]
    for (let i = 1; i < STEPS; i++) {
      const t = i / STEPS
      const cx = Math.round(a.x + (b.x - a.x) * t)
      const cy = Math.round(a.y + (b.y - a.y) * t)
      total++
      let found = false
      for (let dy = -NEAR; dy <= NEAR && !found; dy++) {
        const y = cy + dy
        if (y < 0 || y >= h) continue
        for (let dx = -NEAR; dx <= NEAR; dx++) {
          const x = cx + dx
          if (x < 0 || x >= w) continue
          if (mag[y * w + x] >= cut) {
            found = true
            break
          }
        }
      }
      if (found) hit++
    }
  }
  return total ? hit / total : 0
}

/**
 * The page in the photograph, in the bitmap's own pixels, or null when
 * nothing convincing was found.
 */
export function detectPage(bitmap: ImageBitmap): Quad | null {
  const small = downscale(bitmap)
  if (!small) return null
  const { grey, w, h, scale } = small
  if (w < 40 || h < 40) return null

  const mag = gradient(blur(grey, w, h), w, h)
  const cut = threshold(mag)
  if (cut <= 0) return null

  const { acc, rhos, diag } = hough(mag, w, h, cut)

  const minVotes = Math.max(18, Math.round(Math.min(w, h) * 0.16))
  const lines = peaks(acc, rhos, diag, minVotes, 8, Math.round(Math.min(w, h) * 0.07), 16)
  if (lines.length < 4) return null

  // Split into the two directions a rectangle has. The reference is the
  // strongest line only because something has to be; which family is which
  // does not matter, and both are considered on equal terms below.
  const base = lines[0].theta
  const familyA = lines.filter((l) => angleBetween(l.theta, base) <= Math.PI / 4).slice(0, 6)
  const familyB = lines.filter((l) => angleBetween(l.theta, base) > Math.PI / 4).slice(0, 6)
  if (familyA.length < 2 || familyB.length < 2) return null

  // Every pair of opposite sides that is actually separated, from each
  // direction. Vote count deliberately plays no part from here: on a page of
  // text the rows out-vote the edge of the paper every time, so choosing the
  // loudest lines chooses the writing instead of the page.
  const span = Math.min(w, h) * 0.22
  const pairs = (family: Line[]) => {
    const out: [Line, Line][] = []
    for (let i = 0; i < family.length; i++) {
      for (let j = i + 1; j < family.length; j++) {
        if (Math.abs(family[i].rho - family[j].rho) >= span) out.push([family[i], family[j]])
      }
    }
    return out
  }

  const candidates: Quad[] = []
  for (const a of pairs(familyA)) {
    for (const b of pairs(familyB)) {
      const corners: Point[] = []
      for (const la of a) {
        for (const lb of b) {
          const p = intersect(la, lb)
          if (p) corners.push(p)
        }
      }
      if (corners.length !== 4) continue
      const q = order(corners)
      if (plausible(q, w, h)) candidates.push(q)
    }
  }
  if (!candidates.length) return null

  // The page is the largest shape whose whole outline actually lies on an
  // edge. Requiring the outline to be real is what rules out a rectangle
  // drawn through two lines of text and two imaginary margins; taking the
  // largest of those is what rules out a paragraph inside the page.
  const scored = candidates
    .map((q) => ({ q, support: support(mag, w, h, cut, q), area: area(q) }))
    .sort((m, n) => n.area - m.area)

  const quad =
    scored.find((c) => c.support >= 0.62)?.q ?? scored.find((c) => c.support >= 0.45)?.q
  if (!quad) return null

  // Back to the bitmap's own pixels, pulled in by a hair. A gradient peaks ON
  // the boundary, so the lines land on the edge of the sheet rather than just
  // inside it, and the flattened page picks up a two or three pixel rim of
  // whatever the paper was lying on. There is no content on the edge of a
  // page, so taking a little off costs nothing and removes the rim.
  return inset(
    quad.map((p) => ({ x: p.x / scale, y: p.y / scale })) as Quad,
    0.01,
  )
}

/** Pull the corners toward the middle by a fraction of the shape's size. */
function inset(q: Quad, fraction: number): Quad {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4
  return q.map((p) => ({
    x: p.x + (cx - p.x) * fraction,
    y: p.y + (cy - p.y) * fraction,
  })) as Quad
}

/** The whole frame, for when nothing was found and the person will drag it. */
export function fullFrame(width: number, height: number): Quad {
  const inset = Math.min(width, height) * 0.06
  return [
    { x: inset, y: inset },
    { x: width - inset, y: inset },
    { x: width - inset, y: height - inset },
    { x: inset, y: height - inset },
  ]
}
