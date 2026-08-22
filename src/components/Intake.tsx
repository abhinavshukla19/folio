import type { ReactNode } from 'react'

/**
 * The first screen of a tool, before there is anything to work on.
 *
 * A lit plate with the socket cut into one side and the facts on the other —
 * the same structure the home screen uses, so opening a tool reads as moving
 * closer to one instrument rather than arriving somewhere new. The space beside
 * the socket carries what the tool actually does and where it stops, which is
 * more use than a wall of empty surface.
 *
 * Purely presentational.
 */
export function Intake({
  children,
  does,
  limit,
}: {
  /** The dropzone. */
  children: ReactNode
  /** What you can do once a file is open. Plain sentences, active voice. */
  does: string[]
  /** Where the tool honestly stops. */
  limit?: ReactNode
}) {
  return (
    <div className="table-plane p-2 sm:p-2.5">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:gap-2.5">
        {children}

        <div className="flex flex-col justify-center px-5 py-6 sm:px-6 sm:py-7">
          <ul className="space-y-3">
            {does.map((line) => (
              <li key={line} className="flex gap-3 text-[13.5px] leading-relaxed text-ink-quiet">
                <span
                  aria-hidden="true"
                  className="mt-[0.55em] size-[3px] shrink-0 rounded-full bg-ink-faint"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          {limit && (
            <p className="mt-6 border-t border-edge-soft pt-4 text-[13px] leading-relaxed text-ink-faint">
              {limit}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
