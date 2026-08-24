import { useEffect, useState } from 'react'

export type Route = 'home' | 'organize' | 'images' | 'merge' | 'photo'

/**
 * Routes live under `#/`, so plain in-page anchors (`#tools`, `#faq`) keep
 * working untouched. No router dependency, and it survives a static host with
 * no rewrite rules.
 */
function parse(): Route {
  const hash = window.location.hash
  if (hash.startsWith('#/organize')) return 'organize'
  if (hash.startsWith('#/images')) return 'images'
  if (hash.startsWith('#/merge')) return 'merge'
  if (hash.startsWith('#/photo')) return 'photo'
  return 'home'
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(parse)

  useEffect(() => {
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  useEffect(() => {
    // Anchor links handle their own scrolling; a route change starts at the top.
    if (route !== 'home') window.scrollTo(0, 0)
  }, [route])

  return route
}

export function navigate(route: Route) {
  window.location.hash = route === 'home' ? '' : `#/${route}`
  if (route === 'home') {
    // Clearing the hash leaves a stray '#'; tidy the URL without a reload.
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}
