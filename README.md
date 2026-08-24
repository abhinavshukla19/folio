# Folio

Three PDF tools that run entirely in the browser. No backend exists, so no file
is ever uploaded — the browser reads the file you pick into the tab and the work
happens there.

## Tools

**Edit and rearrange pages.** Drag pages into the order you want, rotate,
delete, duplicate, and download any selection on its own. A full-page editor
adds text in the standard PDF fonts, opaque covers, images and drawn
signatures, each freely movable, resizable and rotatable to any angle.

**Image to PDF.** JPG, PNG and WEBP into one document, with page size,
orientation, margin and quality controls.

**Merge PDFs.** Up to five documents joined in a draggable order.

**Edit a photo.** Crop freely or to a fixed shape, straighten, rotate, flip,
and adjust brightness, contrast and colour. Export at an exact pixel size or
under a file-size limit. Edits are descriptions rather than pixels — every
one is measured against the original decoded bitmap and written exactly once,
at export — so a photo does not lose a generation for each thing you changed.

## Running it

```
npm install
npm run dev
```

The dev server is loopback only. Use `npx vite --host` if you want to reach it
from another device on your network.

```
npm run build     # production bundle in dist/
npx tsc -b        # typecheck
npx oxlint src/   # lint
```

## Installing it

The web build is a PWA: a service worker precaches the whole bundle, including
the pdf.js worker, so an installed copy opens and works with no network at all.
Install it from the browser — "Add to Home screen" on a phone, or the install
button in Chrome's address bar on a desktop.

Cloudflare Pages builds and deploys on every push to `master`. Asset URLs are
relative, so the same build runs from a domain root, a project subdirectory or
the app's own origin without being rebuilt for each; routing is hash-based, so
no host needs rewrite rules either.

There is also an Android wrapper, for a real installable `.apk` that carries
its own copy of the site:

```
npm run app:sync                        # build in capacitor mode, copy into android/
cd android && ./gradlew assembleDebug   # apk in app/build/outputs/apk/debug/
```

Capacitor serves the bundled assets from `https://localhost` inside the app
rather than from `file://`. That is not cosmetic: pdf.js runs its parser in a
Web Worker, and a worker constructed from a `file://` origin is blocked, so the
app would render nothing. A real origin keeps workers, blob URLs and object
URLs behaving exactly as they do in a tab.

The one thing that genuinely differs is saving. A browser download is a blob
handed to the browser's download manager, and inside an app there is no such
thing — an `<a download>` click is silently ignored. On Android the finished
file is written to the app's cache and passed to the system share sheet
instead, which is where "save to Files", Drive and the rest live. That branch
is the whole of `downloadBlob`; everything upstream of it is shared.

## How it works

- `pdf.js` rasterises pages for display, `pdf-lib` assembles the output, and
  `dnd-kit` handles dragging.
- Annotation geometry is normalised against the page *as displayed*, so a text
  box lands where you put it even on a page you have rotated. The mapping back
  into unrotated PDF space lives in one function in `src/lib/pdf/annotations.ts`.
- A cover box hides text but does not remove it from the file. Pages can
  optionally be flattened to a raster on export, which makes the removal real
  while keeping newly added text as vectors.
- A cover's fill is sampled from the page underneath it, so it matches tinted
  or textured paper instead of leaving a white patch.
- Both workspaces are lazy routes, so the landing page does not pull in pdf.js.
- A strict Content-Security-Policy is injected at build time, and fonts are
  self-hosted, so the production bundle makes no outbound request.
- Fitting an image under a byte budget spends quality first and pixels only
  after, because a softer picture reads better than a smaller one. Both ends
  are probed before any search, so the common cases — it already fits, or it
  cannot at this size — cost one or two encodes rather than ten.

## Deliberate limits

- **Password-protected PDFs are not supported.** They are detected and reported
  rather than failing halfway through.
- **There is no compression tool.** A browser can only re-encode the images
  inside a PDF, which frequently makes the file larger. A button that sometimes
  does the opposite of its label is worse than no button.
- **Text already inside a PDF cannot be edited in place.** PDF text is
  positioned glyph runs with subset-embedded fonts and no line or word
  structure. Cover the old text and type over it, and flatten the page if the
  original must actually be gone.
