/** What changed in each release, newest first, shown from the version number. */
export const PATCH_NOTES: { version: string; notes: string[] }[] = [
  {
    version: '1.1.0',
    notes: [
      'Undo and redo: Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y.',
      'Copy and paste the selected close-up or text with Ctrl+C and Ctrl+V; Delete removes the selected item.',
      'The selected close-up or text is marked with corner brackets.',
      'A size for all text, in the Text section. A text resized on its own keeps its size; the link icon in its menu joins it back.',
      'Rotate the selected text with the knob above it; Shift snaps to 15°, a double-click on the knob straightens it.',
      'Speech bubble tails can sit on either edge at each corner: four more spots.',
      "Levels for a photo, like Krita's: set its input and output black and white points.",
      'Blur a photo, or lay a color over it fading from the top or the bottom, with its angle, size and strength: right-click the photo.',
      "Turn the page border off for a single page from its right-click menu in the page strip. That page shows no page number; if it's the first page, it's a cover and numbering starts after it.",
      'Fixed: a right-click menu that grew while open could run off the bottom of the window.',
      'Patch notes, from the version number.',
      'The How to card is shorter and covers {total} and the keys.',
      'Fixed: line breaks in a text gained an extra blank line after editing.',
    ],
  },
  {
    version: '1.0.1',
    notes: ["The web version links back to the app's page on Blushing Defeat."],
  },
  {
    version: '1.0.0',
    notes: [
      'Split pages into panels with bars you can move and tilt; drag and scroll photos to frame them.',
      'Round close-ups with a ring, a shadow and their own photo.',
      'Speech bubbles with a movable tail, caption boxes and outlined text, in bundled fonts or your own.',
      'Several pages to reorder and duplicate, with page numbers.',
      'Page size presets; border, divider and outline widths and colors.',
      'Export a page as WebP or JPG, all pages as a zip, or a PDF.',
      'Autosaves in the browser; save and open .ct project files, photos and fonts included.',
      'Desktop apps for Linux and Windows that work offline, and a skill that lets AI assistants lay out comics.',
    ],
  },
]
