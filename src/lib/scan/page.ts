import type { Point, Quad } from './detect'

/**
 * Turning the photograph into the page.
 *
 * Two things happen here. The quadrilateral the camera saw is mapped back to a
 * rectangle, which is a projective transform and not something a canvas can do
 * on its own — `drawImage` only ever does affine, which cannot make converging
 * edges parallel again. So the mapping is solved directly and the destination
 * is sampled pixel by pixel.
 *
 * Then the page is cleaned. `text` is the one that matters: a single global
 * threshold fails on a photographed page because one corner is always in more
 * light than the other, so the threshold is computed per pixel from its own
 * neighbourhood instead. That is what removes a shadow across a page rather
 * than turning half of it black.
 */

export type Enhance = 'colour' | 'grey' | 'text'

export const ENHANCERS: { id: Enhance; label: string; hint: string }[] = [
  { id: 'colour', label: 'Colour', hint: 'Left as photographed.' },
  { id: 'grey', label: 'Greyscale', hint: 'Neutral, and smaller on disk.' },
  { id: 'text', label: 'Sharpen text', hint: 'Black on white. Removes shadow across a page.' },
]

/** The long edge of a finished page. Above this is detail no print will show. */
const MAX_EDGE = 2400

/* ── the mapping ──────────────────────────────────────────────── */

/**
 * The projective transform taking the output rectangle back to the quad in
 * the photograph, as [a b c d e f g h] where the last row is [g h 1].
 *
 * Solved rather than fitted: four corner correspondences give eight equations
 * in eight unknowns, so there is exactly one answer and no iteration.
 */
function solve(quad: Quad, w: number, h: number): number[] | null {
  const dst: Point[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]

  const m: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i]
    const { x: u, y: v } = quad[i]
    m.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u])
    m.push([0, 0, 0, x, y, 1, -x * v, -y * v, v])
  }

  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return null
    ;[m[col], m[pivot]] = [m[pivot], m[col]]

    const p = m[col][col]
    for (let c = col; c <= 8; c++) m[col][c] /= p

    for (let r = 0; r < 8; r++) {
      if (r === col) continue
      const f = m[r][col]
      if (!f) continue
      for (let c = col; c <= 8; c++) m[r][c] -= f * m[col][c]
    }
  }
  return m.map((row) => row[8])
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * How big the flattened page should be: the longer of each pair of opposite
 * sides, so the corner nearest the camera sets the detail and nothing is
 * resampled up from less than it had.
 */
export function pageSize(quad: Quad) {
  const w = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]))
  const h = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]))
  const shrink = Math.min(1, MAX_EDGE / Math.max(w, h))
  return {
    width: Math.max(1, Math.round(w * shrink)),
    height: Math.max(1, Math.round(h * shrink)),
  }
}

/* ── the flattening ───────────────────────────────────────────── */

function sourcePixels(bitmap: ImageBitmap) {
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0)
  const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  canvas.width = 0
  canvas.height = 0
  return image
}

/**
 * Sample the source for every pixel of the output. Bilinear, so an edge that
 * ran diagonally across the sensor comes back straight rather than stepped.
 */
function warp(src: ImageData, h: number[], outW: number, outH: number) {
  const out = new ImageData(outW, outH)
  const s = src.data
  const d = out.data
  const sw = src.width
  const sh = src.height
  const [a, b, c, e, f, g, p, q] = h

  // Both numerators and the denominator are linear in x, so each steps by a
  // constant along a row. That turns six multiplies per pixel into three
  // additions, which is worth having when the output is several megapixels.
  for (let y = 0; y < outH; y++) {
    let nu = b * y + c
    let nv = f * y + g
    let dn = q * y + 1
    let o = y * outW * 4

    for (let x = 0; x < outW; x++, nu += a, nv += e, dn += p, o += 4) {
      const u = nu / dn
      const v = nv / dn

      if (u < 0 || v < 0 || u > sw - 1 || v > sh - 1) {
        // Outside the photograph. White, so a page dragged past the edge of
        // the frame reads as paper rather than as a hole.
        d[o] = d[o + 1] = d[o + 2] = 255
        d[o + 3] = 255
        continue
      }

      const x0 = u | 0
      const y0 = v | 0
      const x1 = Math.min(x0 + 1, sw - 1)
      const y1 = Math.min(y0 + 1, sh - 1)
      const fx = u - x0
      const fy = v - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4
      const i11 = (y1 * sw + x1) * 4

      for (let k = 0; k < 3; k++) {
        const top = s[i00 + k] + (s[i10 + k] - s[i00 + k]) * fx
        const bot = s[i01 + k] + (s[i11 + k] - s[i01 + k]) * fx
        d[o + k] = top + (bot - top) * fy
      }
      d[o + 3] = 255
    }
  }
  return out
}

/* ── the cleaning ─────────────────────────────────────────────── */

function toGrey(image: ImageData) {
  const g = new Float32Array(image.width * image.height)
  const d = image.data
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    g[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  }
  return g
}

function paint(image: ImageData, grey: Float32Array) {
  const d = image.data
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    d[i] = d[i + 1] = d[i + 2] = grey[p]
  }
}

/**
 * Sauvola's threshold. Each pixel is compared against the mean of its own
 * neighbourhood, pulled down where that neighbourhood is flat — which is what
 * stops blank paper from breaking up into speckle the way a plain local mean
 * does. Both statistics come from summed-area tables, so the window costs the
 * same whatever size it is.
 */
function binarise(grey: Float32Array, w: number, h: number) {
  const n = w * h
  const sum = new Float64Array((w + 1) * (h + 1))
  const sqs = new Float64Array((w + 1) * (h + 1))

  for (let y = 0; y < h; y++) {
    let rs = 0
    let rq = 0
    for (let x = 0; x < w; x++) {
      const v = grey[y * w + x]
      rs += v
      rq += v * v
      const i = (y + 1) * (w + 1) + (x + 1)
      sum[i] = sum[i - (w + 1)] + rs
      sqs[i] = sqs[i - (w + 1)] + rq
    }
  }

  const r = Math.max(7, Math.round(Math.min(w, h) / 16))
  const K = 0.34
  const R = 128
  const out = new Float32Array(n)

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r)
    const y1 = Math.min(h - 1, y + r)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r)
      const x1 = Math.min(w - 1, x + r)
      const count = (x1 - x0 + 1) * (y1 - y0 + 1)

      const a = y0 * (w + 1) + x0
      const b = y0 * (w + 1) + (x1 + 1)
      const c = (y1 + 1) * (w + 1) + x0
      const e = (y1 + 1) * (w + 1) + (x1 + 1)

      const mean = (sum[e] - sum[b] - sum[c] + sum[a]) / count
      const meanSq = (sqs[e] - sqs[b] - sqs[c] + sqs[a]) / count
      const std = Math.sqrt(Math.max(0, meanSq - mean * mean))
      const t = mean * (1 + K * (std / R - 1))
      out[y * w + x] = grey[y * w + x] > t ? 255 : 0
    }
  }
  return out
}

/* ── the whole page ───────────────────────────────────────────── */

/**
 * The photograph, flattened to the quad's rectangle and cleaned. Returns null
 * only when a canvas cannot be had at all.
 */
export function flatten(bitmap: ImageBitmap, quad: Quad, mode: Enhance): ImageData | null {
  const { width, height } = pageSize(quad)
  const h = solve(quad, width, height)
  const src = sourcePixels(bitmap)
  if (!h || !src) return null

  const page = warp(src, h, width, height)
  if (mode === 'colour') return page

  const grey = toGrey(page)
  paint(page, mode === 'text' ? binarise(grey, width, height) : grey)
  return page
}

/** A finished page, as the JPEG the PDF builder wants. */
export async function toFile(page: ImageData, name: string, quality = 0.9): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = page.width
  canvas.height = page.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  ctx.putImageData(page, 0, 0)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('That page could not be saved.')
  return new File([blob], name, { type: 'image/jpeg' })
}

/** A preview small enough to hold several of in memory at once. */
export function thumbnail(page: ImageData, edge = 220): string {
  const scale = Math.min(1, edge / Math.max(page.width, page.height))
  const w = Math.max(1, Math.round(page.width * scale))
  const h = Math.max(1, Math.round(page.height * scale))

  const from = document.createElement('canvas')
  from.width = page.width
  from.height = page.height
  from.getContext('2d')?.putImageData(page, 0, 0)

  const to = document.createElement('canvas')
  to.width = w
  to.height = h
  const ctx = to.getContext('2d')
  if (ctx) {
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(from, 0, 0, w, h)
  }
  from.width = 0
  from.height = 0
  const url = to.toDataURL('image/jpeg', 0.7)
  to.width = 0
  to.height = 0
  return url
}
