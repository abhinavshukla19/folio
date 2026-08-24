# Product notes

Durable decisions about what Folio is, so they do not get re-litigated later.

## Platform

Web. Static SPA on Vite + React 19 + TypeScript + Tailwind 4. No backend, no
server runtime. Deployed by Cloudflare Pages on every push to `master`.

Installable two ways, both carrying the same bundle. The web build is a PWA
whose service worker precaches everything, including the pdf.js worker, so an
installed copy runs with no network. An Android wrapper (Capacitor) puts that
same bundle in a real `.apk`, served from `https://localhost` inside the app
rather than `file://` so the pdf.js worker still starts. The only branch
between them is saving: a browser hands the blob to its download manager,
whereas the app writes the file and passes it to the system share sheet.

## Who it is for

Someone who needs to fix a PDF's pages or assemble images into a PDF, and does
not want that file sitting on someone else's server. The recurring case: a
scanned contract with pages in the wrong order, a sideways scan, a medical or
legal document, or a pile of phone photos of receipts. Usually one task, done
once, on a desktop browser but often on a phone.

## What it does

Three tools that run inside the browser tab.

- **Edit and rearrange pages** — reorder, rotate, delete, duplicate; add text,
  covers, images and drawn signatures; download any selection on its own.
- **Image to PDF** — JPG, PNG and WEBP into one file, with page size,
  orientation, margin and quality controls.
- **Merge PDFs** — up to five documents joined in a draggable order.
- **Edit a photo** — crop to any shape or a fixed one, straighten, rotate,
  flip, and adjust brightness, contrast and colour. Saves at an exact pixel
  size, or under a file-size limit, which is what forms actually ask for.

Success is finishing the task and leaving with a correct file, having never
uploaded anything.

## Positioning

There is no server. Not "we delete your files after an hour" — the file is
never transmitted, because the product is a static bundle with no endpoint to
receive it. A competitor with a backend cannot truthfully make that claim, and
it can be checked in under a minute with the browser's own network panel.

Direct competitors are ad-supported, upload-based, and gate work behind hourly
limits and accounts. Their look is the category default and worth avoiding.

## Capabilities and constraints

- pdf.js renders pages, pdf-lib assembles output, dnd-kit handles reordering.
- Images are decoded and re-encoded through a canvas so WEBP works, since
  pdf-lib cannot embed it directly.
- **Password-protected PDFs are not supported.** Detected and reported plainly
  rather than failing part-way.
- **No PDF compression tool, deliberately.** A browser can only re-encode the
  images inside a PDF, which frequently makes the file larger. Shipping the
  button would be dishonest. A *standalone* image is a different problem with
  an honest answer, which is why the photo tool can hit a byte budget: it
  spends quality first and reduces pixels only if quality alone cannot reach
  the target — and it says so when it has to.
- **Existing PDF text cannot be edited in place.** Cover and retype instead;
  flatten the page when the original must genuinely be removed.
- No hard file-size limit; the ceiling is device memory. Pages rasterise at a
  resolution matched to how large they will be shown.
- Zero third-party network requests, enforced by a strict CSP at build time.
  Fonts are self-hosted. No analytics, no cookies, no accounts.
- Work clears from memory after 10 minutes idle, with a visible countdown and a
  warning first; closing the tab clears immediately.
- Light and dark themes are authored separately, not one filtered from the
  other, and both are switchable.
- Routes are hash-based so the site works on any static host with no rewrites.

## Design commitments

- Name: **Folio**.
- **Voice is plain and factual.** No clever headline constructions, no
  fragments used as sentences, no slogans. Describe what the thing does.
- **A lit work surface in a dim room.** Three planes carry the whole
  structure: the room you stand in, the table raised out of it, and the
  recesses cut into the table where work goes. Raised things take an offset
  shadow, cut things take an inner one, and nothing is a card.
- **There is no brand colour.** The colour on screen is whatever is inside the
  document you opened. The one hue belonging to the interface is the
  safelight amber, and it marks residency and live state only.
- Light and dark are two different rooms rather than one inverted: a daylight
  studio and a darkroom.
- Bricolage Grotesque for display, Public Sans for text, Spline Sans Mono for
  data. The mono appears only where a real number does, never as a label.

## Principles

1. **Verifiable beats stated.** A privacy claim should be something a visitor
   can check; prefer the demonstration over the reassuring sentence.
2. **Honest gaps beat full menus.** Finished tools and a plain "this does not
   do that" outrank a wall of half-working ones.
3. **The task is the product.** Nothing should stand between the first screen
   and the file being open.
4. **Nothing persists.** No account, no history, no storage.

## Accessibility

Keyboard operation for the page grid including selection, reordering and bulk
actions. Visible focus rings, ARIA labelling on page and image cards, 44px
touch targets on coarse pointers, and `prefers-reduced-motion` honoured. Both
themes hold contrast on their own.
