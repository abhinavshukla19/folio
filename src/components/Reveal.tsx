import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Nothing may stay hidden longer than this, whatever the observer does. */
const SAFETY_MS = 1200

/**
 * Reveals its children once, when they first reach the viewport.
 *
 * Fail-safe by construction: the stylesheet only hides an element while it
 * carries data-shown="false", and this component gives up and shows the
 * content if the observer has not reported within SAFETY_MS. A background
 * tab, a browser without IntersectionObserver, or an observer that simply
 * never fires therefore costs the animation, never the content.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  /** Stagger, in ms. */
  delay?: number
  className?: string
  as?: 'div' | 'li' | 'section'
}) {
  const node = useRef<HTMLElement>(null)
  // Start shown — and so skip the animation entirely — when it could not play
  // correctly anyway: no observer, or a document that is not being rendered.
  // A hidden tab does not tick transitions, so an element that began at
  // opacity 0 there would stay there.
  const [shown, setShown] = useState(
    () => typeof IntersectionObserver === 'undefined' || document.hidden,
  )

  useEffect(() => {
    if (shown) return
    const el = node.current
    if (!el) return

    const safety = setTimeout(() => setShown(true), SAFETY_MS)

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            io.disconnect()
            clearTimeout(safety)
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )
    io.observe(el)

    return () => {
      clearTimeout(safety)
      io.disconnect()
    }
  }, [shown])

  return (
    <Tag
      // @ts-expect-error — one ref type across the three allowed tags
      ref={node}
      data-shown={shown}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
      className={`reveal ${className}`}
    >
      {children}
    </Tag>
  )
}
