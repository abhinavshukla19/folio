import { PagePreview } from './PagePreview'
import { Section } from './ui'

export function Preview() {
  return (
    <Section
      id="detail"
      title="What the workspace looks like"
      lead="Every page as a thumbnail you can grab, with the countdown and the upload total in plain sight."
    >
      <PagePreview />
    </Section>
  )
}
