/**
 * Tile density scales to how much there is to look at.
 *
 * One or two pages should fill the space you gave them — a 120px thumbnail
 * in a nine-column grid tells you nothing about a change you just made.
 * Past a handful, the grid tightens so the whole document stays visible at
 * once, and the large view moves into a dedicated focus panel instead.
 */
export type GridPlan = {
  /** Column classes for the tile grid. */
  columns: string
  /** Caps the grid width at low counts so tiles do not stretch absurdly. */
  maxWidth: string
  /** Whether the workspace should also show a large focus panel. */
  focusPanel: boolean
}

export function planGrid(count: number): GridPlan {
  if (count <= 1) return { columns: 'grid-cols-1', maxWidth: 'max-w-[440px]', focusPanel: false }
  if (count === 2) return { columns: 'grid-cols-2', maxWidth: 'max-w-[760px]', focusPanel: false }
  if (count <= 4)
    return { columns: 'grid-cols-2 lg:grid-cols-4', maxWidth: 'max-w-[1100px]', focusPanel: false }
  if (count <= 12)
    return { columns: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5', maxWidth: 'max-w-none', focusPanel: true }
  if (count <= 30)
    return { columns: 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-7', maxWidth: 'max-w-none', focusPanel: true }
  return { columns: 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-9', maxWidth: 'max-w-none', focusPanel: true }
}
