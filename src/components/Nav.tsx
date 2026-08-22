import { Moon, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { GitHubIcon } from './icons'
import { Logo } from './Logo'
import { useTheme } from '../lib/theme'

/**
 * Controls sitting on the room's surface. Nothing you can press is flat here:
 * it lifts to the table's own tone, which is the same rule the slots follow.
 */
function NavControl({
  label,
  href,
  onClick,
  children,
}: {
  label: string
  href?: string
  onClick?: () => void
  children: ReactNode
}) {
  const cls =
    'tap grid h-9 w-9 place-items-center rounded-[4px] text-ink-quiet transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:bg-table hover:text-ink hover:shadow-[var(--lift-1)]'

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={label}
        title={label}
        className={cls}
      >
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      {children}
    </button>
  )
}

/** No rule under it — the room is already a different plane from the table. */
export function Nav() {
  const { theme, toggle } = useTheme()

  return (
    <header>
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
        <a href="#" className="rounded-[3px] text-ink" aria-label="Folio — home">
          <Logo size={20} />
        </a>

        <div className="flex items-center gap-1">
          <NavControl
            label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={toggle}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </NavControl>
          <NavControl label="Source code" href="https://github.com/abhinavshukla19/folio">
            <GitHubIcon size={16} />
          </NavControl>
        </div>
      </div>
    </header>
  )
}
