import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android wrapper. Folio ships its whole web build inside the app, so the
 * installed copy needs no server and no network — the same promise the web
 * version makes, enforced by there being nothing to talk to.
 *
 * Capacitor serves those assets from `https://localhost` inside the app rather
 * than from `file://`. That matters: pdf.js runs its parser in a Web Worker,
 * and workers constructed from a `file://` origin are blocked. A real origin
 * keeps the worker, blob URLs and object URLs all behaving as they do in a
 * browser tab.
 */
const config: CapacitorConfig = {
  appId: 'io.github.abhinavshukla19.folio',
  appName: 'Folio',
  webDir: 'dist',
  android: {
    // Nothing here is a remote page, so a mixed-content allowance would only
    // widen the surface for no gain.
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
