import { Suspense, lazy } from 'react'
import { Landing } from './components/Landing'
import { Nav } from './components/Nav'
import { useHashRoute } from './lib/useHashRoute'

// pdf.js and pdf-lib are several hundred kB together and nothing on the
// landing page needs them, so each workspace loads only when it is opened.
const OrganizePdf = lazy(() =>
  import('./features/organize/OrganizePdf').then((m) => ({ default: m.OrganizePdf })),
)
const ImagesToPdf = lazy(() =>
  import('./features/images/ImagesToPdf').then((m) => ({ default: m.ImagesToPdf })),
)
const MergePdfs = lazy(() =>
  import('./features/merge/MergePdfs').then((m) => ({ default: m.MergePdfs })),
)
const EditPhoto = lazy(() =>
  import('./features/photo/EditPhoto').then((m) => ({ default: m.EditPhoto })),
)

function RouteFallback() {
  return (
    <p className="px-6 py-24 text-center text-[13px] text-ink-3" role="status">
      Loading…
    </p>
  )
}

export default function App() {
  const route = useHashRoute()

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[4px] focus:bg-ink focus:px-3.5 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-table"
      >
        Skip to content
      </a>
      <Nav />

      {route === 'home' && <Landing />}
      {route !== 'home' && (
        <Suspense fallback={<RouteFallback />}>
          {route === 'organize' && <OrganizePdf />}
          {route === 'images' && <ImagesToPdf />}
          {route === 'merge' && <MergePdfs />}
          {route === 'photo' && <EditPhoto />}
        </Suspense>
      )}
    </>
  )
}
