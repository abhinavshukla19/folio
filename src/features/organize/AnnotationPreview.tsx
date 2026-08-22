import { FONT_STACKS, inPaintOrder, type Annotation } from '../../lib/pdf/annotations'

/**
 * A read-only rendering of a page's annotations, for thumbnails and the focus
 * panel — so an edited page looks edited everywhere, not only inside the editor.
 *
 * Sizing uses container query units: 1cqw is one percent of this layer's own
 * width, so a point size converts to screen size without measuring anything in
 * JavaScript, at any thumbnail scale.
 */
export function AnnotationPreview({
  annotations,
  boxWidth,
}: {
  annotations: Annotation[]
  /** The page's display width in PDF points. */
  boxWidth: number
}) {
  if (!annotations.length) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ containerType: 'inline-size' }}
    >
      {inPaintOrder(annotations).map((a) => (
        <div
          key={a.id}
          className="absolute"
          style={{
            left: `${a.x * 100}%`,
            top: `${a.y * 100}%`,
            width: `${a.width * 100}%`,
            height: `${a.height * 100}%`,
            transform: `rotate(${a.rotation}deg)`,
            opacity: a.opacity,
          }}
        >
          {a.kind === 'box' && <div className="h-full w-full" style={{ background: a.color }} />}

          {a.kind === 'image' && (
            <img src={a.dataUrl} alt="" className="h-full w-full object-fill" />
          )}

          {a.kind === 'text' && (
            <div
              className="h-full w-full whitespace-pre-wrap break-words"
              style={{
                fontFamily: FONT_STACKS[a.fontId],
                fontWeight: a.bold ? 700 : 400,
                fontStyle: a.italic ? 'italic' : 'normal',
                color: a.color,
                textAlign: a.align,
                fontSize: `${(a.size / boxWidth) * 100}cqw`,
                lineHeight: 1.25,
              }}
            >
              {a.text}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
