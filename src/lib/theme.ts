import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'folio-theme'

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * The first paint is already correct thanks to `public/theme-init.js`, so this
 * hook only mirrors and mutates the class the bootstrap script set.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)

  useEffect(() => {
    const root = document.documentElement

    /*
     * Transitions are suppressed for the duration of the swap. Two reasons:
     * the flip reads better as instant than as a 200ms cross-fade, and — the
     * real one — a property that is mid-`transition` does not recompute when
     * the custom property feeding it changes, so transitioned colours would
     * otherwise keep the previous theme's value until something else forced a
     * restyle. Suppress, mutate, let it settle, restore.
     */
    root.classList.add('theme-switching')
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
    void getComputedStyle(root).opacity // force the restyle while transitions are off

    // A timeout rather than rAF: rAF never fires in a background tab, which
    // would leave the suppression class stuck on and transitions dead.
    const restore = setTimeout(() => root.classList.remove('theme-switching'), 0)

    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* private mode — the class is still applied, we just can't remember it */
    }

    return () => clearTimeout(restore)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
