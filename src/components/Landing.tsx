import type { ReactNode } from 'react'
import { DiagramCrop, DiagramImages, DiagramMerge, DiagramRearrange, DiagramScan } from './Diagrams'
import { Ledger } from './Ledger'
import { Questions } from './Questions'

type Tool = {
  name: string
  desc: string
  action: string
  href: string
  diagram: ReactNode
}

/* Names match the workspace each slot opens, so a control keeps its name all
   the way through. */
const TOOLS: Tool[] = [
  {
    name: 'Edit & rearrange pages',
    desc: 'Reorder, rotate and delete pages, then add text, covers or a signature.',
    action: 'Open a PDF',
    href: '#/organize',
    diagram: <DiagramRearrange />,
  },
  {
    name: 'Image to PDF',
    desc: 'Combine photos and scans into one file, at the page size you set.',
    action: 'Open images',
    href: '#/images',
    diagram: <DiagramImages />,
  },
  {
    name: 'Edit a photo',
    desc: 'Crop, straighten and adjust. Save at an exact size, or under a file-size limit.',
    action: 'Open a photo',
    href: '#/photo',
    diagram: <DiagramCrop />,
  },
  {
    name: 'Merge PDFs',
    desc: 'Join up to five documents, in the order you drag them into.',
    action: 'Open several PDFs',
    href: '#/merge',
    diagram: <DiagramMerge />,
  },
]

/**
 * Three sockets cut into one lit plate. They are recesses, not cards: the
 * shadow is on the inside, and pointing at one fills it with light.
 */
export function Landing() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
      <h1 className="display max-w-[52rem] text-balance text-[clamp(2.05rem,5.9vw,3.5rem)]">
        Edit, convert and merge PDFs without uploading them.
      </h1>

      <div className="lights-up table-plane relative mt-9 p-2 sm:mt-12 sm:p-2.5">
        {/* The one people come back for, given the width to say so. */}
        <a
          href="#/scan"
          className="slot recess group mb-2 flex gap-4 rounded-[5px] p-5 sm:mb-2.5 lg:items-center lg:gap-8 lg:px-7 lg:py-6"
        >
          <span className="block h-12 w-[76px] shrink-0 text-ink-quiet lg:h-20 lg:w-[168px]">
            <DiagramScan />
          </span>

          <span className="flex min-w-0 flex-col lg:flex-1">
            <h2 className="text-[16px] font-semibold tracking-[-0.012em] lg:text-[19px]">
              Scan to PDF
            </h2>
            <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-ink-quiet lg:mt-2 lg:text-[14.5px]">
              Photograph a page. Its corners are found, the perspective is straightened, and the
              shadow comes off — then save the lot as one document.
            </p>
          </span>

          <span
            className="mt-4 hidden h-9 w-fit shrink-0 items-center self-center rounded-[4px] bg-accent px-3.5 text-[14px] font-semibold tracking-[-0.005em] text-accent-ink transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-px lg:mt-0 lg:inline-flex"
            style={{ boxShadow: 'var(--lift-1)' }}
          >
            Open the camera
          </span>
        </a>

        <div className="grid gap-2 lg:grid-cols-4 lg:gap-2.5">
          {TOOLS.map((tool) => (
            <a
              key={tool.href}
              href={tool.href}
              /* On a phone the socket lies on its side so three of them still
                 fit the thumb's reach; from lg up it stands as a column. */
              className="slot recess group flex gap-4 rounded-[5px] p-5 lg:flex-col lg:gap-0 lg:px-6 lg:pb-6 lg:pt-7"
            >
              <span className="block h-12 w-[76px] shrink-0 text-ink-quiet lg:h-14 lg:w-[120px]">
                {tool.diagram}
              </span>

              <span className="flex min-w-0 flex-col lg:contents">
                <h2 className="text-[16px] font-semibold tracking-[-0.012em] lg:mt-6 lg:text-[17px]">
                  {tool.name}
                </h2>

                <p className="mt-1.5 max-w-[38ch] text-[13.5px] leading-relaxed text-ink-quiet lg:mt-2 lg:flex-1 lg:text-[14px]">
                  {tool.desc}
                </p>

                {/* A control sitting in the socket: raised out of the recess,
                    and it rises further under the pointer. */}
                <span
                  className="mt-4 inline-flex h-9 w-fit items-center rounded-[4px] bg-accent px-3.5 text-[13.5px] font-semibold tracking-[-0.005em] text-accent-ink transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-px lg:mt-6 lg:text-[14px]"
                  style={{ boxShadow: 'var(--lift-1), var(--rim)' }}
                >
                  {tool.action}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>

      <Ledger />

      <Questions />
    </main>
  )
}
