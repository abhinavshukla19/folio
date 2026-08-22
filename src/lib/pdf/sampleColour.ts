/**
 * Reads the dominant colour beneath a region of the page.
 *
 * A cover box that matches the paper it sits on is invisible; one that is
 * always white leaves an obvious patch on anything tinted, textured or
 * off-white. This samples what is actually there.
 *
 * The image is drawn into a canvas already turned to the page's display
 * orientation, so the region can be given in the same normalised display
 * coordinates the editor uses — no rotation maths at the call site.
 */
export async function sampleRegionColour(
  src: string,
  region: { x: number; y: number; width: number; height: number },
  displayAspect: number,
  thumbRotation = 0,
): Promise<string | null> {
  const img = await loadImage(src)

  // Work at a modest size; we want the dominant colour, not detail.
  const cw = 600
  const ch = Math.max(1, Math.round(cw / displayAspect))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const turned = Math.abs(thumbRotation % 180) === 90
  ctx.save()
  ctx.translate(cw / 2, ch / 2)
  ctx.rotate((thumbRotation * Math.PI) / 180)
  // When turned, the image's own box is the canvas box with sides swapped.
  const dw = turned ? ch : cw
  const dh = turned ? cw : ch
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()

  const sx = Math.max(0, Math.round(region.x * cw))
  const sy = Math.max(0, Math.round(region.y * ch))
  const sw = Math.max(1, Math.min(cw - sx, Math.round(region.width * cw)))
  const sh = Math.max(1, Math.min(ch - sy, Math.round(region.height * ch)))
  if (sw < 1 || sh < 1) return null

  const { data } = ctx.getImageData(sx, sy, sw, sh)

  // Bucket to 5 bits per channel and take the mode: the paper wins over the
  // ink sitting on it, which is exactly what a cover should match.
  const counts = new Map<number, number>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (!counts.size) return null

  let bestKey = 0
  let bestCount = -1
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      bestKey = key
    }
  }

  // Average the winning bucket's actual pixels so the result is not quantised.
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)
    if (key !== bestKey) continue
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    n++
  }
  if (!n) return null

  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the page image'))
    img.src = src
  })
}
