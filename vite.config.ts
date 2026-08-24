import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Folio is a zero-backend app: every byte of a user's file is processed in the
 * tab it was dropped into. The production CSP below is the enforcement of that
 * promise — no CDN, no analytics, no font host, no `connect-src` beyond self.
 * It is injected on `build` only, so the dev server's HMR websocket still works.
 *
 * The service worker fits inside it unchanged: it is same-origin, so
 * `worker-src 'self'` already covers it, the manifest falls back to
 * `default-src 'self'`, and the registration is emitted as its own file rather
 * than inline so `script-src 'self'` still holds with no hash or nonce.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  // No frame-ancestors: browsers ignore it in a <meta> CSP and log an error
  // for it on every load. It only works as an HTTP response header, which a
  // static host does not let us set.
].join('; ')

/**
 * Every asset URL is relative to the page, so the build runs from wherever it
 * is put: the domain root, a project subdirectory like GitHub Pages serves,
 * or the app's own origin. Absolute URLs were pinning it to one path and a
 * redirect, and anything opened outside that path came up blank. Routing is
 * hash-based already, so no host needs rewrite rules either.
 */
const BASE = process.env.FOLIO_BASE ?? './'

export default defineConfig(({ command, mode }) => {
  // `vite build --mode capacitor` produces the bundle that ships inside the
  // Android app. Same relative URLs; what differs is the service worker,
  // which is pointless there -- the assets are already on the device, so
  // there is no network to be offline from.
  const forApp = mode === 'capacitor'

  return {
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: forApp,
      registerType: 'autoUpdate',
      // A separate file, not an inline script: the CSP forbids inline script.
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Folio — edit and merge PDFs',
        short_name: 'Folio',
        description:
          'Reorder, rotate and delete PDF pages, add text or a signature, and turn images into PDFs. Everything runs on your own device.',
        lang: 'en',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#14161a',
        background_color: '#14161a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs is precached, including the pdf.js worker,
        // so an installed Folio opens and works with no network at all.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
    {
      name: 'folio-csp',
      transformIndexHtml(html: string) {
        if (command !== 'build') return html
        return html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        )
      },
    },
  ],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  // No `server.host` on purpose: Vite's default is loopback only, so the dev
  // server is not reachable from other devices. Run `vite --host` for a one-off
  // if you ever want it on the network.
  }
})
