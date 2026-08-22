import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Logo } from './Logo'
import { Button, Container } from './ui'
import { useTheme } from '../lib/theme'

const LINKS = [
  { href: '#tools', label: 'Tools' },
  { href: '#how', label: 'How it works' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#faq', label: 'FAQ' },
]

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="tap grid h-10 w-10 place-items-center rounded-control text-body transition-colors duration-200 hover:bg-violet-wash hover:text-violet"
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 bg-plate transition-[border-color] duration-300 ${
        scrolled ? 'border-b border-hairline' : 'border-b border-transparent'
      }`}
    >
      <Container>
        <nav className="flex h-[72px] items-center justify-between gap-6">
          <a href="#top" className="tap inline-flex items-center rounded-control text-ink" aria-label="Folio — home">
            <Logo size={22} />
          </a>

          <ul className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="u-draw text-[14px] font-medium text-body transition-colors duration-200 hover:text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button href="#tools" size="md" className="tap hidden sm:inline-flex">
              Open a file
            </Button>
          </div>
        </nav>
      </Container>
    </header>
  )
}
