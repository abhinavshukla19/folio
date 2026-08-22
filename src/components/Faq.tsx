import { Plus } from 'lucide-react'
import { Section } from './ui'

const QA: Array<{ q: string; a: string }> = [
  {
    q: 'Is my file really never uploaded?',
    a: 'Yes. The site is a static bundle with no backend, so there is no endpoint that could receive it. The browser reads the file into this tab and the work happens there.',
  },
  {
    q: 'What happens if I close the tab?',
    a: 'Everything is cleared. That also means unsaved work is genuinely gone, so download your document before you leave.',
  },
  {
    q: 'Can it open password-protected PDFs?',
    a: 'No. Folio detects them and says so plainly rather than failing part-way through. Remove the password in your PDF reader first and it will open normally.',
  },
  {
    q: 'Why is there no compress tool?',
    a: 'Because doing it honestly is not possible in a browser. What a web app can do is re-encode the images inside a PDF, which frequently makes the file larger. A button that sometimes does the opposite of its label is worse than no button.',
  },
  {
    q: 'Is there a file size limit?',
    a: 'No quota — the ceiling is your own device memory rather than an upload cap. Pages are rendered as they are needed, so large documents stay responsive.',
  },
]

export function Faq() {
  return (
    <Section id="faq" title="Questions" lead="Including the ones about what Folio deliberately does not do.">
      <div className="card divide-y divide-[var(--hairline)] overflow-hidden">
        {QA.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex list-none items-center justify-between gap-6 px-6 py-5 transition-colors duration-200 hover:bg-violet-wash sm:px-7">
              <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{item.q}</h3>
              <Plus
                size={18}
                className="shrink-0 text-muted transition-transform duration-300 group-open:rotate-45 group-open:text-violet"
              />
            </summary>
            <p className="px-6 pb-6 pr-14 text-[15px] leading-relaxed text-body sm:px-7">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}
