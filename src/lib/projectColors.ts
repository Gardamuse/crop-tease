import { normalizeHex } from './color'
import { BLACK } from './constants'
import { leaves } from './layout'
import { store } from './store'

// The colors a color row offers: black and white, then the colors used most
// elsewhere in the project, then a custom color from the picker.

export const BASE_COLORS = [
  { label: 'Black', color: BLACK },
  { label: 'White', color: '#ffffff' },
]

/** how many of the project's colors a color row shows (empty slots stay as placeholders) */
export const PROJECT_COLOR_SLOTS = 6

/**
 * Every color setting in the project that's in use, each with a key naming
 * it ('border', 'outline', 'text' (the project's text color), 'fill:<panel
 * id>', 'overlay:<panel or close-up id>', 'text:<text id>'), so a color row
 * can leave out its own.
 */
function colorUses(): { key: string; color: string }[] {
  const uses = [
    { key: 'border', color: store.border.color },
    { key: 'outline', color: store.border.outlineColor },
    { key: 'text', color: store.textColor },
  ]
  for (const page of store.pages) {
    for (const leaf of leaves(page.layout)) {
      if (leaf.fill) uses.push({ key: `fill:${leaf.id}`, color: leaf.fill })
      if (leaf.frame && leaf.overlay) uses.push({ key: `overlay:${leaf.id}`, color: leaf.overlay.color })
    }
    for (const el of page.elements) {
      if (el.kind === 'text') {
        if (el.color) uses.push({ key: `text:${el.id}`, color: el.color })
      } else if (el.frame && el.overlay) uses.push({ key: `overlay:${el.id}`, color: el.overlay.color })
    }
  }
  if (store.pageNumber?.color) uses.push({ key: `text:${store.pageNumber.id}`, color: store.pageNumber.color })
  return uses.flatMap(({ key, color }) => {
    const hex = color && normalizeHex(color)
    return hex ? [{ key, color: hex }] : []
  })
}

/**
 * The project's most used colors other than black and white, most used
 * first (ties in the order they first appear), not counting the setting
 * named `ownKey`, so the row doesn't change under the color being edited.
 */
export function projectColors(ownKey: string): string[] {
  const counts = new Map<string, number>()
  for (const { key, color } of colorUses()) {
    if (key === ownKey || BASE_COLORS.some((c) => c.color === color)) continue
    counts.set(color, (counts.get(color) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, PROJECT_COLOR_SLOTS)
    .map(([color]) => color)
}
