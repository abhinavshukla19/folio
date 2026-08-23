import { Capacitor } from '@capacitor/core'
import { PDFDocument, degrees } from 'pdf-lib'
import { drawAnnotations, embedFontsFor, type AnnotationMap } from './annotations'

/* ── Organize: rebuild a document from a page list ──────────── */

export type PageSpec = {
  /** Identifies this page instance, so its annotations can be found. */
  id?: string
  /** 0-based index into the original document. Repeats mean duplicates. */
  source: number
  /** Extra rotation in degrees, added on top of the page's own. */
  rotation: number
}

/** A page rasterised to replace its vector content, keyed by page id. */
export type RasterMap = Record<string, { bytes: Uint8Array; widthPt: number; heightPt: number }>

export async function buildPdf(
  bytes: Uint8Array,
  pages: PageSpec[],
  annotations?: AnnotationMap,
  rasters?: RasterMap,
): Promise<Blob> {
  if (!pages.length) throw new Error('Nothing to export — the document has no pages left.')

  const src = await PDFDocument.load(bytes)
  const out = await PDFDocument.create()

  // copyPages handles repeated indices, returning a distinct page per entry.
  const copied = await out.copyPages(
    src,
    pages.map((p) => p.source),
  )

  // Every text annotation across the document, so each face is embedded once.
  const used = annotations
    ? pages.flatMap((p) => (p.id ? (annotations[p.id] ?? []) : []))
    : []
  const fonts = used.length ? await embedFontsFor(out, used) : undefined

  for (let i = 0; i < pages.length; i++) {
    const spec = pages[i]
    const raster = spec.id ? rasters?.[spec.id] : undefined
    let page

    if (raster) {
      // Flattened: the original page's objects are replaced by a picture of
      // them, so anything a cover box hides is genuinely gone rather than
      // merely painted over. New annotations still draw as vectors on top.
      const img = await out.embedPng(raster.bytes)
      page = out.addPage([raster.widthPt, raster.heightPt])
      page.drawImage(img, { x: 0, y: 0, width: raster.widthPt, height: raster.heightPt })
      const extra = ((spec.rotation % 360) + 360) % 360
      if (extra) page.setRotation(degrees(extra))
    } else {
      page = copied[i]
      const extra = spec.rotation % 360
      if (extra) {
        const current = page.getRotation().angle
        page.setRotation(degrees((current + extra + 360) % 360))
      }
      out.addPage(page)
    }

    const forPage = spec.id && annotations ? annotations[spec.id] : undefined
    if (forPage?.length && fonts) {
      await drawAnnotations(out, page, forPage, fonts, page.getRotation().angle)
    }
  }

  const saved = await out.save()
  return new Blob([saved as BufferSource], { type: 'application/pdf' })
}

/* ── Merge ──────────────────────────────────────────────────── */

/** One document waiting to be merged, in the order it will appear. */
export type MergeSource = {
  name: string
  bytes: Uint8Array
}

/**
 * Concatenates whole documents, in the order given.
 *
 * Pages are copied rather than referenced, so the result stands alone and
 * nothing about the originals is carried along.
 */
export async function mergePdfs(
  sources: MergeSource[],
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (sources.length < 2) throw new Error('Add at least two PDFs to merge.')

  const out = await PDFDocument.create()
  for (let i = 0; i < sources.length; i++) {
    const src = await PDFDocument.load(sources[i].bytes)
    const copied = await out.copyPages(src, src.getPageIndices())
    copied.forEach((page) => out.addPage(page))
    onProgress?.(i + 1, sources.length)
  }

  const saved = await out.save()
  return new Blob([saved as BufferSource], { type: 'application/pdf' })
}

/* ── Images to PDF ──────────────────────────────────────────── */

export type PageSizeId = 'fit' | 'a4' | 'letter'
export type Orientation = 'portrait' | 'landscape'

export const PAGE_SIZES: Record<Exclude<PageSizeId, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

export const MARGINS = { none: 0, small: 18, medium: 36, large: 56 } as const
export type MarginId = keyof typeof MARGINS

export type ImageSpec = {
  file: File
  /** Multiple of 90. */
  rotation: number
}

export type ImageOptions = {
  size: PageSizeId
  orientation: Orientation
  margin: MarginId
  /** JPEG quality, 0–1. */
  quality: number
}

/** Browser-decode, apply rotation, and re-encode as JPEG so every input format
 *  (including WEBP, which pdf-lib cannot embed) lands the same way. */
async function normalise(spec: ImageSpec, quality: number) {
  const bitmap = await createImageBitmap(spec.file)
  const turned = Math.abs(spec.rotation % 180) === 90
  const width = turned ? bitmap.height : bitmap.width
  const height = turned ? bitmap.width : bitmap.height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')

  // JPEG has no alpha; without this, transparent PNGs come out black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.translate(width / 2, height / 2)
  ctx.rotate((spec.rotation * Math.PI) / 180)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  canvas.width = 0
  canvas.height = 0
  if (!blob) throw new Error('Could not encode image')

  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height }
}

export async function imagesToPdf(
  images: ImageSpec[],
  opts: ImageOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  if (!images.length) throw new Error('Add at least one image first.')

  const doc = await PDFDocument.create()
  const margin = MARGINS[opts.margin]

  for (let i = 0; i < images.length; i++) {
    const { bytes, width, height } = await normalise(images[i], opts.quality)
    const embedded = await doc.embedJpg(bytes)

    let pageW: number
    let pageH: number

    if (opts.size === 'fit') {
      // Treat source pixels as 96dpi, the usual screen assumption.
      pageW = width * 0.75 + margin * 2
      pageH = height * 0.75 + margin * 2
    } else {
      const [w, h] = PAGE_SIZES[opts.size]
      const portrait = opts.orientation === 'portrait'
      pageW = portrait ? w : h
      pageH = portrait ? h : w
    }

    const page = doc.addPage([pageW, pageH])
    const boxW = Math.max(pageW - margin * 2, 1)
    const boxH = Math.max(pageH - margin * 2, 1)
    const scale = Math.min(boxW / width, boxH / height)
    const drawW = width * scale
    const drawH = height * scale

    page.drawImage(embedded, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH,
    })

    onProgress?.(i + 1, images.length)
  }

  const saved = await doc.save()
  return new Blob([saved as BufferSource], { type: 'application/pdf' })
}

/* ── Saving ─────────────────────────────────────────────────── */

/** Base64 without the `data:` prefix, which is what the file bridge wants. */
function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the finished file.'))
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma === -1 ? result : result.slice(comma + 1))
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Inside the Android app there is no browser download manager to hand a blob
 * to: an `<a download>` click is silently ignored. The file is written to the
 * app's own cache instead and handed to the system sheet, which is where
 * "save to Files", Drive and everything else lives.
 *
 * Both plugins are imported lazily so the web bundle never pays for them.
 */
async function saveOnDevice(blob: Blob, filename: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])

  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await toBase64(blob),
    directory: Directory.Cache,
  })

  await Share.share({ title: filename, url: uri })
}

/**
 * Hands the finished file to whatever can save it. On the web that is the
 * browser's own download, triggered synchronously so it stays inside the
 * click that asked for it.
 */
export async function downloadBlob(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    await saveOnDevice(blob, filename)
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke late; Safari needs the URL alive when the click is processed.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
