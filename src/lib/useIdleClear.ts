import { useCallback, useEffect, useRef, useState } from 'react'

export const IDLE_TIMEOUT = 10 * 60 * 1000
const WARN_AT = 60 * 1000

/**
 * Wipes the workspace after a stretch of no interaction. The countdown is
 * surfaced to the user rather than firing as a surprise, and any real activity
 * resets it. Only runs while `active` — an empty workspace has nothing to clear.
 *
 * The remaining time is derived from a wall-clock deadline rather than counted
 * down tick by tick, so a throttled background tab can't make it drift.
 */
export function useIdleClear(active: boolean, onClear: () => void, timeout = IDLE_TIMEOUT) {
  const [remaining, setRemaining] = useState(timeout)
  const deadline = useRef(0)
  const lastReset = useRef(0)
  const clearRef = useRef(onClear)

  useEffect(() => {
    clearRef.current = onClear
  }, [onClear])

  const keepAlive = useCallback(() => {
    deadline.current = Date.now() + timeout
    setRemaining(timeout)
  }, [timeout])

  useEffect(() => {
    deadline.current = Date.now() + timeout
    setRemaining(timeout)
    if (!active) return

    const bump = () => {
      const now = Date.now()
      // Throttle: pointermove fires constantly and we only need a heartbeat.
      if (now - lastReset.current < 2000) return
      lastReset.current = now
      deadline.current = now + timeout
    }

    const events: Array<keyof WindowEventMap> = [
      'pointerdown',
      'pointermove',
      'keydown',
      'wheel',
      'touchstart',
    ]
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    const tick = setInterval(() => {
      const left = deadline.current - Date.now()
      setRemaining(Math.max(0, left))
      if (left <= 0) clearRef.current()
    }, 1000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(tick)
    }
  }, [active, timeout])

  return {
    remaining,
    warning: active && remaining <= WARN_AT,
    keepAlive,
    label: formatDuration(remaining),
  }
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
