import type { ReactNode } from 'react'

type Ask = {
  q: string
  a: ReactNode
}

/**
 * The things a person reasonably wants settled before they hand a document to
 * a web page. Every answer here is checkable against the app or the source —
 * none of it is reassurance, which is the only kind of answer worth giving
 * when the whole claim is that nothing leaves the tab.
 */
const ASKS: Ask[] = [
  {
    q: 'How can it edit a PDF without uploading it?',
    a: (
      <>
        Because the browser already has everything the job needs. Your file is read into memory in
        this tab, and the parsing, rewriting and rendering all happen here, in JavaScript and
        WebAssembly. There is no step that sends the bytes anywhere — and a strict
        Content&#8209;Security&#8209;Policy leaves the page nowhere to send them to even if there
        were.
      </>
    ),
  },
  {
    q: 'Is there a file size limit?',
    a: (
      <>
        No fixed one. The ceiling is your device&rsquo;s memory rather than a quota someone set, so
        a large document that works on a laptop may struggle on an old phone. Nothing here counts
        pages, watermarks a result, or asks you to wait behind anyone else&rsquo;s queue.
      </>
    ),
  },
  {
    q: 'Does my document lose quality?',
    a: (
      <>
        Not for PDFs. Pages are carried across as the objects they already are rather than
        re&#8209;rendered into pictures, so text stays selectable text and fonts stay embedded. A
        photo is different: JPEG has to be re&#8209;encoded when you save it. So the photo tool
        treats your edits as a description and writes them exactly once, at export — ten changes
        cost the same single encode as one, instead of a generation each. Saving as PNG is exact.
      </>
    ),
  },
  {
    q: 'What happens to my file when I close the tab?',
    a: (
      <>
        It is gone. Nothing is written to disk, no copy is queued for later, and there is no account
        holding anything, because there are no accounts. Closing the tab is the delete button. The
        only thing kept between visits is whether you chose the light or the dark theme.
      </>
    ),
  },
  {
    q: 'Why is there no button to compress a PDF?',
    a: (
      <>
        Because a browser can only re&#8209;encode the images inside a PDF, and doing that
        frequently produces a <em>larger</em> file than it started with. A button that sometimes did
        the opposite of its label would be worse than no button. A single image is a different
        problem with an honest answer, which is why the photo tool can hold a file under a size a
        form gives you — and tells you when it has to drop pixels to get there.
      </>
    ),
  },
  {
    q: 'Does it work offline, and can I install it?',
    a: (
      <>
        Yes to both. The whole app is stored on your first visit, so it keeps working with no
        connection at all — which is the strongest version of the promise, since a page with no
        network cannot be uploading anything. Your browser&rsquo;s menu will offer to install it
        alongside your other apps.
      </>
    ),
  },
  {
    q: 'What is the catch?',
    a: (
      <>
        There is no server to run, so there is nothing to charge for and nothing to sell. No
        accounts, no analytics, no third&#8209;party scripts — the ledger above counts them live,
        and the source is on GitHub if you would rather read it than take the word of a page that
        wrote itself.
      </>
    ),
  },
]

/**
 * The answers, folded away.
 *
 * A native `<details>` rather than state: the browser already knows how to open
 * one, keyboards and screen readers already know how to reach it, and it costs
 * the app nothing to remember. The first is left open so the section reads as
 * something to unfold rather than a row of closed bars.
 */
export function Questions() {
  return (
    <section aria-labelledby="asks-heading" className="mt-14 sm:mt-20">
      <h2
        id="asks-heading"
        className="text-[17px] font-semibold tracking-[-0.01em] sm:text-[19px]"
      >
        The questions this usually raises.
      </h2>

      <div className="table-plane mt-5 px-5 sm:px-7">
        {ASKS.map((ask, i) => (
          <details key={ask.q} open={i === 0} className="ask border-b border-edge-soft last:border-b-0">
            <summary className="tap flex items-center gap-4 py-4 text-left">
              <span className="flex-1 text-[15px] font-medium leading-snug tracking-[-0.01em] sm:text-[15.5px]">
                {ask.q}
              </span>
              <span className="ask-mark" aria-hidden="true" />
            </summary>

            <p className="max-w-[68ch] pb-5 pr-6 text-[13.5px] leading-[1.7] text-ink-quiet sm:text-[14px]">
              {ask.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
