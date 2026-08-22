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
