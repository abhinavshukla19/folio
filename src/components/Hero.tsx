import { ArrowRight, Images, LayoutGrid } from 'lucide-react'
import { Ribbon } from './Ribbon'
import { Button, Container } from './ui'
import { Reveal } from './Reveal'

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pb-16 pt-16 sm:pb-24 sm:pt-24">
      <Ribbon className="-right-40 -top-44 h-[840px] w-[600px] sm:-right-24 lg:-right-4" />

      <Container className="relative">
        <div className="max-w-[36rem]">
          <Reveal>
            <h1 className="display text-[2.75rem] sm:text-[3.9rem]">
              Edit PDFs entirely
              <br />
              <span className="text-violet">in your browser.</span>
            </h1>
          </Reveal>

          <Reveal delay={90}>
            <p className="mt-6 max-w-[30rem] text-[18px] leading-[1.6] text-body">
              Reorder, rotate and extract pages, or turn a folder of images into one document.
              Your file is never uploaded, and no account is needed.
            </p>
          </Reveal>

          <Reveal delay={170}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button href="#/organize" size="lg" className="w-full sm:w-auto">
                <LayoutGrid size={17} />
                Edit a PDF
                <ArrowRight size={17} className="arrow-slide" />
              </Button>
              <Button href="#/images" variant="secondary" size="lg" className="w-full sm:w-auto">
                <Images size={17} />
                Images to PDF
              </Button>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
