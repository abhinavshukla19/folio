import { GitHubIcon } from './icons'
import { Logo } from './Logo'
import { Container } from './ui'

const YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="border-t border-hairline">
      <Container>
        <div className="grid gap-8 py-12 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Logo size={22} />
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-body">
              Two client-side document tools. No server, no account, no analytics and no
              third-party code, enforced by a content security policy at build time.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/abhinavshukla19/folio"
              target="_blank"
              rel="noreferrer noopener"
              className="tap u-draw inline-flex items-center gap-2 py-3 text-[14px] font-semibold text-body transition-colors duration-200 hover:text-violet"
            >
              <GitHubIcon size={15} />
              Read the source
            </a>
            <span className="text-[13px] text-muted">{YEAR}</span>
          </div>
        </div>
      </Container>
    </footer>
  )
}
