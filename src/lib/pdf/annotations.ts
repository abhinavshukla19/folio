import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

/* ── Model ──────────────────────────────────────────────────────────────
 *
 * Every geometry value is normalised 0..1 against the page as the user sees
 * it — its *display* box, after any rotation. That keeps the editor's maths
 * trivial (it works in the box it draws) and confines the awkward part to one
 * function, `toUnrotated` below.
 */

export type FontId = 'helvetica' | 'times' | 'courier'
export type TextAlign = 'left' | 'center' | 'right'

type Base = {
  id: string
  /** Normalised against the displayed page box. */
  x: number
  y: number
  width: number
  height: number
  /** Clockwise degrees, as CSS rotates. Free — not stepped to 90s. */
  rotation: number
  opacity: number
}

export type TextAnnotation = Base & {
  kind: 'text'
  /** Box hugs its content until the user resizes it by hand. */
  autoFit?: boolean
  text: string
  fontId: FontId
  bold: boolean
  italic: boolean
  /** Points. */
  size: number
  color: string
  align: TextAlign
}

export type BoxAnnotation = Base & {
  kind: 'box'
  color: string
}

export type ImageAnnotation = Base & {
  kind: 'image'
  /** PNG data URL — a drawn signature or an uploaded image. */
  dataUrl: string
}

export type Annotation = TextAnnotation | BoxAnnotation | ImageAnnotation

/** Annotations keyed by the page instance they belong to. */
export type AnnotationMap = Record<string, Annotation[]>

/**
 * A cover is a patch of background by definition, so it must never be able to
 * paint over the words placed on it. Order is fixed by kind rather than by the
 * order things were added: covers, then images, then text on top.
 */
const PAINT_ORDER: Record<Annotation['kind'], number> = { box: 0, image: 1, text: 2 }

export function inPaintOrder(list: Annotation[]) {
  return [...list].sort((a, b) => PAINT_ORDER[a.kind] - PAINT_ORDER[b.kind])
}

/**
 * The size a text box needs to hold its content, in PDF points.
 *
 * Measured with the browser's own metrics, which differ a little from the
 * standard-font metrics pdf-lib uses at export, so a small allowance stops a
 * line that fits on screen from wrapping in the file.
 */
let measuringContext: CanvasRenderingContext2D | null = null

export function measureTextBox(
  text: string,
  fontId: FontId,
  bold: boolean,
  italic: boolean,
  size: number,
) {
  if (!measuringContext) {
    measuringContext = document.createElement('canvas').getContext('2d')
  }
  const lines = text.length ? text.split('\n') : ['']
  let width = size
  if (measuringContext) {
    measuringContext.font = `${italic ? 'italic ' : ''}${bold ? 700 : 400} ${size}px ${FONT_STACKS[fontId]}`
    for (const line of lines) {
      width = Math.max(width, measuringContext.measureText(line || ' ').width)
    }
  }
  return {
    width: width + size * 0.3,
    height: lines.length * size * 1.25,
  }
}

export const FONT_LABELS: Record<FontId, string> = {
  helvetica: 'Helvetica',
  times: 'Times',
  courier: 'Courier',
}

/** CSS stacks chosen to match the PDF standard fonts as closely as a browser can. */
export const FONT_STACKS: Record<FontId, string> = {
  helvetica: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  times: '"Times New Roman", Times, "Liberation Serif", serif',
  courier: '"Courier New", Courier, "Liberation Mono", monospace',
}

const STANDARD: Record<FontId, Record<string, StandardFonts>> = {
  helvetica: {
    regular: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    bolditalic: StandardFonts.HelveticaBoldOblique,
  },
  times: {
    regular: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    bolditalic: StandardFonts.TimesRomanBoldItalic,
  },
  courier: {
    regular: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    bolditalic: StandardFonts.CourierBoldOblique,
  },
}

export function styleKey(bold: boolean, italic: boolean) {
  return bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'regular'
}

export function standardFontFor(fontId: FontId, bold: boolean, italic: boolean) {
  return STANDARD[fontId][styleKey(bold, italic)]
}

/* ── Colour ─────────────────────────────────────────────────────────── */

export function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/* ── Geometry ───────────────────────────────────────────────────────── */

/**
 * Maps a point from the page as displayed (origin top-left, y down, already
 * rotated by `spin`) into the page's own unrotated PDF space (origin
 * bottom-left, y up) — which is the only space pdf-lib draws in.
 *
 * `mw`/`mh` are the unrotated media box dimensions.
 */
function toUnrotated(dx: number, dy: number, spin: number, mw: number, mh: number) {
  switch (((spin % 360) + 360) % 360) {
    case 90:
      return { x: dy, y: dx }
    case 180:
      return { x: mw - dx, y: dy }
    case 270:
      return { x: mw - dy, y: mh - dx }
    default:
      return { x: dx, y: mh - dy }
  }
}

function rotatePoint(px: number, py: number, cx: number, cy: number, rad: number) {
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

/** Wraps text to a width, honouring explicit newlines. */
export function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number) {
  const out: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      out.push('')
      continue
    }
    let line = ''
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate
      } else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}

/* ── Drawing ────────────────────────────────────────────────────────── */

export type FontBook = Map<string, PDFFont>

export async function embedFontsFor(doc: PDFDocument, annotations: Annotation[]): Promise<FontBook> {
  const book: FontBook = new Map()
  for (const a of annotations) {
    if (a.kind !== 'text') continue
    const key = `${a.fontId}-${styleKey(a.bold, a.italic)}`
    if (!book.has(key)) {
      book.set(key, await doc.embedFont(standardFontFor(a.fontId, a.bold, a.italic)))
    }
  }
  return book
}

/**
 * Draws one page's annotations onto the copied output page.
 *
 * `spin` is the page's total rotation as the user saw it while editing, so the
 * annotation is placed where they put it regardless of how the page is turned.
 */
export async function drawAnnotations(
  out: PDFDocument,
  page: PDFPage,
  annotations: Annotation[],
  fonts: FontBook,
  spin: number,
) {
  if (!annotations.length) return

  const { width: mw, height: mh } = page.getSize()
  const turned = ((spin % 360) + 360) % 360 % 180 === 90
  // The box the user was actually looking at.
  const dw = turned ? mh : mw
  const dh = turned ? mw : mh

  for (const a of inPaintOrder(annotations)) {
    const bx = a.x * dw
    const by = a.y * dh
    const bw = a.width * dw
    const bh = a.height * dh

    // Centre in unrotated PDF space — the pivot everything turns about.
    const centre = toUnrotated(bx + bw / 2, by + bh / 2, spin, mw, mh)
    // The viewer will spin the page by `spin`, so subtract it here to leave the
    // annotation at the angle the user chose. PDF angles run anticlockwise.
    const pdfAngle = spin - a.rotation
    const rad = (pdfAngle * Math.PI) / 180

    const place = (localX: number, localY: number) => {
      const p = toUnrotated(bx + localX, by + localY, spin, mw, mh)
      return rotatePoint(p.x, p.y, centre.x, centre.y, rad)
    }

    if (a.kind === 'box') {
      const anchor = place(0, bh) // bottom-left of the box, in display terms
      page.drawRectangle({
        x: anchor.x,
        y: anchor.y,
        width: bw,
        height: bh,
        color: hexToRgb(a.color),
        opacity: a.opacity,
        rotate: degrees(pdfAngle),
      })
      continue
    }

    if (a.kind === 'image') {
      const bytes = await fetch(a.dataUrl).then((r) => r.arrayBuffer())
      const img = await out.embedPng(new Uint8Array(bytes))
      const anchor = place(0, bh)
      page.drawImage(img, {
        x: anchor.x,
        y: anchor.y,
        width: bw,
        height: bh,
        opacity: a.opacity,
        rotate: degrees(pdfAngle),
      })
      continue
    }

    const font = fonts.get(`${a.fontId}-${styleKey(a.bold, a.italic)}`)
    if (!font) continue

    const lines = wrapLines(a.text, font, a.size, bw)
    const lineHeight = a.size * 1.25
    const ascent = font.heightAtSize(a.size, { descender: false })

    lines.forEach((line, i) => {
      if (!line) return
      const lineWidth = font.widthOfTextAtSize(line, a.size)
      const offsetX =
        a.align === 'center' ? (bw - lineWidth) / 2 : a.align === 'right' ? bw - lineWidth : 0
      // Baseline sits an ascent below the line's top edge.
      const anchor = place(offsetX, i * lineHeight + ascent)
      page.drawText(line, {
        x: anchor.x,
        y: anchor.y,
        size: a.size,
        font,
        color: hexToRgb(a.color),
        opacity: a.opacity,
        rotate: degrees(pdfAngle),
      })
    })
  }
}
