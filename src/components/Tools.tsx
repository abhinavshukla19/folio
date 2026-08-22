import { ArrowUpRight, Combine, Images, LayoutGrid } from 'lucide-react'
import type { ReactNode } from 'react'
import { Container } from './ui'
import { Reveal } from './Reveal'

type Tool = {
  no: string
  icon: ReactNode
  name: string
  desc: string
  accepts: string
  href: string
}

const TOOLS: Tool[] = [
  {
    no: '01',
    icon: <LayoutGrid size={20} />,
    name: 'Edit & rearrange pages',
    desc: 'Reorder, rotate, delete or duplicate pages, add text or a signature, and download any selection on its own.',
    accepts: 'PDF',
    href: '#/organize',
  },
  {
    no: '02',
    icon: <Images size={20} />,
    name: 'Image to PDF',
    desc: 'Turn JPG, PNG and WEBP files into one PDF, with control over page size and margins.',
    accepts: 'JPG · PNG · WEBP',
    href: '#/images',
  },
  {
    no: '03',
    icon: <Combine size={20} />,
    name: 'Merge PDFs',
    desc: 'Join up to five documents into one file, in whatever order you drag them into.',
    accepts: 'Up to 5 PDFs',
    href: '#/merge',
  },
]

export function Tools() {
  return (
    <section id="tools" className="scroll-mt-24 pb-8">
      <Container>
        <div className="grid gap-5 md:grid-cols-3">
          {TOOLS.map((tool, i) => (
            <Reveal key={tool.no} delay={i * 90}>
              <a href={tool.href} className="card hoverable group flex h-full flex-col p-7 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-control bg-violet-wash text-violet">
                    {tool.icon}
                  </span>
                  <ArrowUpRight
                    size={18}
                    className="arrow-slide mt-1 text-muted transition-colors duration-200 group-hover:text-violet"
                  />
                </div>

                <h3 className="mt-6 text-[20px] font-bold tracking-[-0.02em]">{tool.name}</h3>
                <p className="mt-2.5 flex-1 text-[15px] leading-relaxed text-body">{tool.desc}</p>

                <div className="mt-7 flex items-center gap-3 border-t border-hairline pt-4">
                  <span className="label">Accepts</span>
                  <span className="text-[13px] font-semibold text-ink">{tool.accepts}</span>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
