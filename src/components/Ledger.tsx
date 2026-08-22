import { useEffect, useState } from 'react'

/**
 * The product's claim, as an account rather than a sentence.
 *
 * The first figure is measured live from this page: every resource the tab
 * has fetched is checked against its own origin, and anything from somewhere
 * else is counted. It reads zero because a strict CSP leaves nowhere else to
 * fetch from — and because that is checkable in the browser's own network
 * panel, the number is worth more here than a reassuring subtitle would be.
 *
 * Purely presentational. It observes the page; it touches nothing in the app.
 */

/** Resource entries whose origin is not this page's. */
function countForeign(): number {
  if (typeof performance?.getEntriesByType !== 'function') return 0
  const here = location.origin
  return performance.getEntriesByType('resource').filter((entry) => {
    try {
      const { origin, protocol } = new URL(entry.name, here)
      // blob: and data: never leave the tab, so they are not another server.
      if (protocol === 'blob:' || protocol === 'data:') return false
      return origin !== here
    } catch {
      return false
    }
  }).length
}

type Line = {
  label: string
  value: string
  /** True where the figure is read from the page rather than stated. */
  measured?: boolean
}

export function Ledger() {
  const [foreign, setForeign] = useState(0)

  useEffect(() => {
    setForeign(countForeign())
    if (typeof PerformanceObserver !== 'function') return
    // Keep it honest for the life of the page: if anything ever did reach
    // out, the figure would climb rather than sit at a hardcoded zero.
    const observer = new PerformanceObserver(() => setForeign(countForeign()))
    try {
      observer.observe({ type: 'resource', buffered: true })
    } catch {
      return
    }
    return () => observer.disconnect()
  }, [])

  const lines: Line[] = [
    { label: 'requests to another server', value: String(foreign), measured: true },
    { label: 'bytes of your file uploaded', value: '0' },
    { label: 'accounts required', value: '0' },
    { label: 'files kept after you close the tab', value: '0' },
  ]

  return (
    <section aria-labelledby="ledger-heading" className="mt-14 sm:mt-20">
      <h2 id="ledger-heading" className="text-[17px] font-semibold tracking-[-0.01em] sm:text-[19px]">
        {foreign === 0
          ? 'Nothing has left this tab.'
          : `${foreign} request${foreign === 1 ? '' : 's'} left this tab.`}
      </h2>

      <dl className="mt-5 border-t border-edge-soft">
        {lines.map((line) => (
          <div
            key={line.label}
            className="flex items-baseline gap-3 border-b border-edge-soft py-3.5 sm:gap-4"
          >
            <dt className="shrink-0 text-[14px] text-ink-quiet sm:text-[15px]">{line.label}</dt>

            {/* leader dots, the way an index carries the eye to its figure */}
            <span
              aria-hidden="true"
              className="min-w-4 flex-1 translate-y-[-0.3em] border-b border-dotted border-edge"
            />

            <dd className="data shrink-0 text-[22px] font-medium leading-none sm:text-[26px]">
              {line.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 max-w-[62ch] text-[13.5px] leading-relaxed text-ink-quiet">
        The first figure is counted live on this page, not written into it. Open your browser&rsquo;s
        network panel and watch it stay where it is.
      </p>
    </section>
  )
}
