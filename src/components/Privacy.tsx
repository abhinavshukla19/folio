import { FileCode2, Timer, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Section, Stat } from './ui'

const LEDGER: Array<[string, string]> = [
  ['Files uploaded', '0'],
  ['Requests to other servers', '0'],
  ['Trackers and cookies', '0'],
  ['Accounts required', '0'],
]

const GUARANTEES: Array<{ icon: ReactNode; title: string; body: string }> = [
  {
    icon: <Timer size={18} />,
    title: 'Clears itself after ten minutes',
    body: 'A countdown runs in the toolbar and resets whenever you interact. Closing the tab clears everything at once.',
  },
  {
    icon: <FileCode2 size={18} />,
    title: 'No third-party code',
    body: 'Fonts, icons and scripts all come from this one origin, and a strict content security policy blocks anything else.',
  },
  {
    icon: <WifiOff size={18} />,
    title: 'Works with the network off',
    body: 'Disconnect and keep going. A tool that genuinely needs a server cannot do that, which makes it easy to check.',
  },
]

export function Privacy() {
  return (
    <Section
      id="privacy"
      title="Nothing is uploaded"
      lead="Folio has no backend. That is not a promise about how carefully your file is handled — there is no endpoint to send it to, and you can confirm that yourself in under a minute."
    >
      <div className="card grid grid-cols-2 divide-x divide-y divide-[var(--hairline)] sm:grid-cols-4 sm:divide-y-0">
        {LEDGER.map(([label, value]) => (
          <Stat key={label} label={label} value={value} status="positive" />
        ))}
      </div>

      <p className="mt-5 rounded-part bg-violet-wash p-5 text-[15px] leading-relaxed text-body">
        <span className="font-semibold text-ink">Check it now.</span> Open your browser&rsquo;s
        developer tools, switch to the Network tab, then drop in a 50&nbsp;MB PDF. The list stays
        empty while the file opens.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {GUARANTEES.map((g) => (
          <div key={g.title} className="card p-7">
            <span className="grid h-10 w-10 place-items-center rounded-control bg-violet-wash text-violet">
              {g.icon}
            </span>
            <h3 className="mt-5 text-[17px] font-bold tracking-[-0.02em]">{g.title}</h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-body">{g.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
