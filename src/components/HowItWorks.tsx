import { Section } from './ui'

const STEPS = [
  {
    n: '01',
    title: 'Open a file',
    body: 'It loads straight from your device into this tab. There is no upload step, so there is nothing to wait for.',
  },
  {
    n: '02',
    title: 'Make your changes',
    body: 'Reorder, rotate, delete, duplicate. Every edit happens in memory, and every one can be undone.',
  },
  {
    n: '03',
    title: 'Download',
    body: 'The new document is assembled here in the browser and saved straight to your device.',
  },
]

export function HowItWorks() {
  return (
    <Section
      id="how"
      title="Three steps, none of them a wait"
      lead="The whole flow is local, which is also why it is quick. A long document opens about as fast as your machine can draw it."
    >
      <ol className="grid gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="card p-7">
            <span className="figure text-[15px] text-violet">{s.n}</span>
            <h3 className="mt-4 text-[18px] font-bold tracking-[-0.02em]">{s.title}</h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-body">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
