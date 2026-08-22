import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Bundled from our own origin — never a CDN, so the strict CSP holds.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type LoadedPdf = {
  /** Untouched copy of the file, kept for pdf-lib to re-assemble from. */
  bytes: Uint8Array
  pageCount: number
  /** Intrinsic size of each page in CSS px at scale 1, after its own rotation. */
  sizes: Array<{ width: number; height: number }>
  doc: pdfjs.PDFDocumentProxy
}

export class EncryptedPdfError extends Error {
  constructor() {
    super('This PDF is password protected.')
    this.name = 'EncryptedPdfError'
  }
}

export class BrokenPdfError extends Error {
  constructor() {
    super('This file could not be read as a PDF.')
    this.name = 'BrokenPdfError'
  }
}

export async function loadPdf(file: File): Promise<LoadedPdf> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  // pdf.js transfers the buffer it is given to its worker, which detaches it.
  // Hand over a copy so `bytes` stays usable for export.
  const task = pdfjs.getDocument({ data: bytes.slice() })

  let doc: pdfjs.PDFDocumentProxy
  try {
    doc = await task.promise
  } catch (err) {
    const name = (err as { name?: string })?.name
    if (name === 'PasswordException') throw new EncryptedPdfError()
    throw new BrokenPdfError()
  }

  const sizes: Array<{ width: number; height: number }> = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const vp = page.getViewport({ scale: 1 })
    sizes.push({ width: vp.width, height: vp.height })
  }

  return { bytes, pageCount: doc.numPages, sizes, doc }
}

/**
 * How large to rasterise each page, given how many there are.
 *
 * Page count decides tile size (see lib/layout.ts), and a thumbnail rendered
 * smaller than the tile it lands in looks soft or, worse, sits marooned at its
 * natural size in the middle of a large empty tile. Few pages therefore get a
 * much bigger raster; a long document keeps the cheap one.
 */
export function thumbnailEdgeFor(pageCount: number) {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  const base = pageCount <= 2 ? 1000 : pageCount <= 4 ? 760 : pageCount <= 12 ? 520 : 360
  return Math.round(base * dpr)
}

/**
 * Renders a page to a blob URL sized for how large it is about to appear.
 *
 * The grid's thumbnails are deliberately small; reusing one in the editor and
 * scaling it up is what makes a page look soft. This renders for the real
 * display width instead, at the screen's pixel ratio. Caller owns the URL.
 */
export async function renderPageAtWidth(
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  cssWidth: number,
): Promise<string> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2)
  // Cap the raster so an extreme zoom cannot allocate an enormous canvas.
  const targetPx = Math.min(cssWidth * dpr, 5000)
  const scale = Math.max(0.2, targetPx / base.width)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, viewport, background: '#ffffff' }).promise

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92))
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('Could not render page')
  return URL.createObjectURL(blob)
}

/**
 * Rasterises a page to PNG bytes at print resolution, for flattening.
 *
 * Returns the page's size in points alongside the pixels, so the replacement
 * page can be made the same physical size as the one it stands in for.
 */
export async function renderPageBytes(
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  targetDpi = 150,
): Promise<{ bytes: Uint8Array; widthPt: number; heightPt: number }> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  // PDF user space is 72 units per inch.
  const scale = Math.min(targetDpi / 72, 4)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, viewport, background: '#ffffff' }).promise

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('Could not rasterise page')

  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    widthPt: base.width,
    heightPt: base.height,
  }
}

/**
 * Renders one page to a blob URL. Caller owns the URL and must revoke it.
 * `maxEdge` caps the long side so a poster-sized page doesn't allocate a
 * hundred megapixels for a thumbnail.
 */
export async function renderThumbnail(
  doc: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  maxEdge = 340,
): Promise<string> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(maxEdge / Math.max(base.width, base.height), 4)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)

  // Pass `canvas` alone — pdf.js v6 treats canvas + canvasContext together as a
  // conflict, and `background` gives us the white page fill anyway.
  await page.render({ canvas, viewport, background: '#ffffff' }).promise

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('Could not rasterise page')
  return URL.createObjectURL(blob)
}
