import { Faq } from './components/Faq'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Nav } from './components/Nav'
import { Preview } from './components/Preview'
import { Privacy } from './components/Privacy'
import { Tools } from './components/Tools'
import { useHashRoute } from './lib/useHashRoute'
import { Suspense, lazy } from 'react'

// pdf.js and pdf-lib are ~340kB together and nothing on the landing page
// needs them, so each workspace loads only when its route is opened.
const OrganizePdf = lazy(() =>
  import('./features/organize/OrganizePdf').then((m) => ({ default: m.OrganizePdf })),
)
const ImagesToPdf = lazy(() =>
  import('./features/images/ImagesToPdf').then((m) => ({ default: m.ImagesToPdf })),
)
const MergePdfs = lazy(() =>
  import('./features/merge/MergePdfs').then((m) => ({ default: m.MergePdfs })),
)

function RouteFallback() {
  return (
    <div className="px-8 py-28 text-center text-[14px] text-muted" role="status">
      Loading workspace
    </div>
  )
}

function Home() {
  return (
    <>
      <main>
        <Hero />
        <Tools />
        <Preview />
        <HowItWorks />
        <Privacy />
        <Faq />
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  const route = useHashRoute()

  return (
    <>
      <a
        href="#tools"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-violet focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-violet-ink"
      >
        Skip to tools
      </a>
      <Nav />

      {route === 'home' && <Home />}
      {route !== 'home' && (
        <Suspense fallback={<RouteFallback />}>
          {route === 'organize' && <OrganizePdf />}
          {route === 'images' && <ImagesToPdf />}
          {route === 'merge' && <MergePdfs />}
        </Suspense>
      )}
    </>
  )
}
