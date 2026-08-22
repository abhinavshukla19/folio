import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


/**
 * Folio is a zero-backend app: every byte of a user's file is processed in the
 * tab it was dropped into. The production CSP below is the enforcement of that
 * promise — no CDN, no analytics, no font host, no `connect-src` beyond self.
 * It is injected on `build` only, so the dev server's HMR websocket still works.
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
  "frame-ancestors 'none'",
].join('; ')

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
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
}))
