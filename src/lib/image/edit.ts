/**
 * Photo editing, done once.
 *
 * Every operation here is a description, not a pixel: an edit is a small
 * object, and the image is only ever rendered from the *original* decoded
 * bitmap. Nothing is applied to an already-rendered result, so cropping,
 * straightening and adjusting in any order costs exactly one encode — the one
 * at the end, rather than one per change.
 *
 * That is as far as the promise goes, and the rest is worth being exact
 * about. Re-encoding a JPEG is lossy however carefully it is done: measured
 * on a detailed photograph, a single pass through here at the default
 * quality moves the average channel by about 1.7 of 255, and saving that
 * result again moves it further. The pipeline is not what costs it — the
 * same picture exported as PNG comes back pixel-identical to its source.
 * What this design buys is that the toll is paid once, on the way out,
 * however much was changed on the way through.
 */

export type Edit = {
  /** Crop rectangle, in the pixels of the oriented image (see `orientedSize`). */
  crop: { x: number; y: number; w: number; h: number }
  /** Whole turns, applied before straightening. */
  quarterTurns: 0 | 1 | 2 | 3
  /** Fine rotation in degrees, for a horizon that is a little off. */
  straighten: number
  flipX: boolean
  flipY: boolean
  /** 1 is untouched, for all three. */
  brightness: number
  contrast: number
  saturation: number
}

export const NO_EDIT: Omit<Edit, 'crop'> = {
  quarterTurns: 0,
  straighten: 0,
  flipX: false,
  flipY: false,
  brightness: 1,
  contrast: 1,
  saturation: 1,
}

export type Source = { bitmap: ImageBitmap; width: number; height: number }

/** A quarter turn swaps the axes; everything downstream works in this space. */
export function orientedSize(src: { width: number; height: number }, quarterTurns: number) {
  return quarterTurns % 2 === 0
    ? { width: src.width, height: src.height }
    : { width: src.height, height: src.width }
}

export function fullFrameCrop(src: { width: number; height: number }, quarterTurns = 0) {
  const { width, height } = orientedSize(src, quarterTurns)
  return { x: 0, y: 0, w: width, h: height }
}

/**
 * How much a straightened picture has to grow to keep covering its own frame.
 *
 * Rotating a rectangle leaves wedges of nothing in the corners. Rather than
 * fill those with a colour that was never in the photograph, the picture is
 * zoomed just enough that the frame stays inside it -- which is what every
 * darkroom and every photo editor has always done. The cost is a sliver of the
 * edges, and the alternative is white triangles in the corners of a print.
 */
export function coverScale(width: number, height: number, degrees: number) {
  if (!degrees) return 1
  const a = Math.abs((degrees * Math.PI) / 180)
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  // The frame, turned back the other way, has to fit inside the picture.
  return Math.max(
    (width * cos + height * sin) / width,
    (width * sin + height * cos) / height,
  )
}

/** CSS filter string, so the adjustments cost nothing until something draws. */
function filterFor(edit: Edit) {
  const parts: string[] = []
  if (edit.brightness !== 1) parts.push(`brightness(${edit.brightness})`)
  if (edit.contrast !== 1) parts.push(`contrast(${edit.contrast})`)
  if (edit.saturation !== 1) parts.push(`saturate(${edit.saturation})`)
  return parts.length ? parts.join(' ') : 'none'
}

/**
 * Draws the edited image into a canvas of the given output size.
 *
 * `outWidth`/`outHeight` default to the crop's own pixel size, which is what
 * keeps an export at source resolution. Passing something smaller is a
 * deliberate downscale, not a side effect of how it was previewed.
 */
export function renderEdit(
  src: Source,
  edit: Edit,
  outWidth?: number,
  outHeight?: number,
  background = '#ffffff',
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(outWidth ?? edit.crop.w))
  const h = Math.max(1, Math.round(outHeight ?? edit.crop.h))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // JPEG has no alpha, so a straightened photo would otherwise show black
  // wedges where the frame runs past the picture.
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = filterFor(edit)

  // Map the crop rectangle onto the output surface.
  ctx.scale(w / edit.crop.w, h / edit.crop.h)
  ctx.translate(-edit.crop.x, -edit.crop.y)

  // Then place the oriented image inside that space.
  const oriented = orientedSize(src, edit.quarterTurns)
  ctx.translate(oriented.width / 2, oriented.height / 2)
  ctx.rotate((edit.straighten * Math.PI) / 180 + (edit.quarterTurns * Math.PI) / 2)
  const cover = coverScale(oriented.width, oriented.height, edit.straighten)
  ctx.scale(cover * (edit.flipX ? -1 : 1), cover * (edit.flipY ? -1 : 1))
  ctx.drawImage(src.bitmap, -src.width / 2, -src.height / 2)

  return canvas
}

export type Format = 'image/jpeg' | 'image/png' | 'image/webp'

export const FORMAT_LABELS: Record<Format, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
}

export const EXTENSION: Record<Format, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function encode(canvas: HTMLCanvasElement, format: Format, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))),
      format,
      quality,
    )
  })
}

export type FitResult = {
  blob: Blob
  /** What the file actually came out as, which is not always what was asked. */
  width: number
  height: number
  quality: number
  /** True when even the smallest quality at these dimensions overshot. */
  scaled: boolean
  metTarget: boolean
}

/**
 * Encodes to land under a byte budget.
 *
 * Quality is spent first and dimensions only after, because dropping detail is
 * recoverable by eye in a way that dropping pixels is not. PNG is lossless and
 * ignores quality entirely, so for PNG there is nothing to trade but size.
 */
export async function encodeUnder(
  src: Source,
  edit: Edit,
  format: Format,
  outWidth: number,
  outHeight: number,
  targetBytes?: number,
  fixedQuality = 0.92,
): Promise<FitResult> {
  const draw = (w: number, h: number) => renderEdit(src, edit, w, h)

  if (!targetBytes) {
    const blob = await encode(draw(outWidth, outHeight), format, fixedQuality)
    return {
      blob,
      width: outWidth,
      height: outHeight,
      quality: fixedQuality,
      scaled: false,
      metTarget: true,
    }
  }

  let width = outWidth
  let height = outHeight
  let scaled = false

  const TOP = 0.96
  const FLOOR = 0.05

  // Four rounds at most. Each one asks two cheap questions before searching,
  // because most pictures are answered by one of them.
  for (let round = 0; round < 4; round++) {
    const canvas = draw(width, height)

    // PNG is lossless: there is no quality to trade, only pixels.
    if (format === 'image/png') {
      const blob = await encode(canvas, format, 1)
      if (blob.size <= targetBytes || round === 3) {
        return { blob, width, height, quality: 1, scaled, metTarget: blob.size <= targetBytes }
      }
      const shrink = Math.min(0.9, Math.max(0.3, Math.sqrt(targetBytes / blob.size) * 0.95))
      width = Math.max(1, Math.round(width * shrink))
      height = Math.max(1, Math.round(height * shrink))
      scaled = true
      continue
    }

    // 1. Does the best quality already fit? A small output against a generous
    //    budget usually does, and then there is nothing to search for.
    const best = await encode(canvas, format, TOP)
    if (best.size <= targetBytes) {
      return { blob: best, width, height, quality: TOP, scaled, metTarget: true }
    }

    // 2. Does the worst quality still overshoot? Then no amount of searching
    //    helps at this size, and the picture has to get smaller. How much
    //    smaller is measurable rather than guessable: bytes track pixel count,
    //    so the side scales with the square root of how far over we are.
    const floor = await encode(canvas, format, FLOOR)
    if (floor.size > targetBytes) {
      if (round === 3) {
        return { blob: floor, width, height, quality: FLOOR, scaled, metTarget: false }
      }
      const shrink = Math.min(0.9, Math.max(0.25, Math.sqrt(targetBytes / floor.size) * 0.95))
      width = Math.max(1, Math.round(width * shrink))
      height = Math.max(1, Math.round(height * shrink))
      scaled = true
      continue
    }

    // 3. The answer is somewhere between. Halve towards it, and stop as soon
    //    as the file is using most of the budget -- past that the extra
    //    encodes buy quality no one can see.
    let low = FLOOR
    let high = TOP
    let chosen = { blob: floor, quality: FLOOR }

    for (let i = 0; i < 8; i++) {
      const mid = (low + high) / 2
      const blob = await encode(canvas, format, mid)
      if (blob.size <= targetBytes) {
        chosen = { blob, quality: mid }
        if (blob.size >= targetBytes * 0.92) break
        low = mid
      } else {
        high = mid
      }
    }

    return { blob: chosen.blob, width, height, quality: chosen.quality, scaled, metTarget: true }
  }

  // Unreachable: round 3 always returns.
  const blob = await encode(draw(width, height), format, FLOOR)
  return { blob, width, height, quality: FLOOR, scaled, metTarget: blob.size <= targetBytes }
}

/** Bytes as a person would say them. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1000) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/** Keeps a crop rectangle inside the picture, and honouring a fixed ratio. */
export function clampCrop(
  crop: { x: number; y: number; w: number; h: number },
  bounds: { width: number; height: number },
  ratio?: number,
) {
  let { x, y, w, h } = crop

  w = Math.max(16, Math.min(w, bounds.width))
  h = Math.max(16, Math.min(h, bounds.height))

  if (ratio) {
    // Fit the ratio inside what was asked for, so a drag never grows the box
    // beyond the frame just to satisfy the shape.
    if (w / h > ratio) w = h * ratio
    else h = w / ratio
    if (w > bounds.width) {
      w = bounds.width
      h = w / ratio
    }
    if (h > bounds.height) {
      h = bounds.height
      w = h * ratio
    }
  }

  x = Math.max(0, Math.min(x, bounds.width - w))
  y = Math.max(0, Math.min(y, bounds.height - h))
  return { x, y, w, h }
}
