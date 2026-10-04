/**
 * One change; or a larger one with smaller related changes (sub), shown
 * indented under it.
 */
export type PatchNote = string | { text: string; sub: string[] }

/** What changed in each release, newest first, shown from the version number. */
export const PATCH_NOTES: { version: string; notes: PatchNote[] }[] = [
  {
    version: '1.2.0',
    notes: [
      {
        text: 'Added Recent projects (the clock button), which keeps every project you work on so you can open it again later.',
        sub: [
          'New project no longer replaces the open project; it stays in Recent projects.',
          'Opening a .ct file that is already in Recent projects now opens that one instead of a copy.',
          'Your autosaved project is now in Recent projects.',
        ],
      },
      'Added Color splash, which turns a photo gray except for one color (right-click the photo, or the Filters section for all photos).',
      "Levels, Color balance and Color splash in a photo's right-click menu can now be set to None, which ignores the Filters section for that photo.",
      'Added a Rotation slider to the right-click menu of photos and text; Shift snaps to 15°.',
      {
        text: 'Added a Color for all text in the Text section, which text follows until you give it its own.',
        sub: [
          'New text is now black instead of dark purple.',
        ],
      },
      {
        text: 'Color rows now offer black, white and up to six colors used elsewhere in the project, plus the color picker.',
        sub: [
          'The color picker has H, S and L sliders for fine-tuning a color.',
        ],
      },
      'Dividers can now have their own width (right-click one and choose Local).',
      {
        text: 'Added Images + PDF to the export section, which saves the page images and the PDF together in one zip.',
        sub: [
          'The export section shows the image size, and each export says what it makes.',
        ],
      },
      {
        text: 'Photo effects in the right-click menu and the Filters section now fold under their headings, showing their settings on one line until opened.',
        sub: [
          "The overlay's Rotate slider is now called Angle.",
        ],
      },
      "Added Remove image to a close-up's right-click menu.",
      {
        text: 'The Font dropdown in the text right-click menu now shows each font in its own typeface.',
        sub: [
          'Fonts are now listed by name, after Classic, in the Text section and the Font dropdown.',
        ],
      },
      'Fixed: splitting a panel could open the image picker.',
      'Fixed: a right-click menu tall enough to scroll also scrolled sideways.',
      'Fixed: scrolling inside a right-click menu closed it.',
    ],
  },
  {
    version: '1.1.2',
    notes: ['Fixed: in Firefox, a mirrored close-up could still show its photo outside the circle at some zoom levels.'],
  },
  {
    version: '1.1.1',
    notes: [
      "Mirror a photo left to right: the Mirror toggle in the photo's right-click menu.",
      'Fixed: close-up photos were hidden in the page strip thumbnails.',
      'Fixed: a mirrored close-up could show its photo outside the circle at some zoom levels.',
    ],
  },
  {
    version: '1.1.0',
    notes: [
      'Undo and redo: Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y.',
      'Copy and paste the selected close-up or text with Ctrl+C and Ctrl+V; Delete removes the selected item.',
      'The selected close-up or text is marked with corner brackets; the arrow keys move it (Shift for further), and clicking around the page deselects it.',
      'A size for all text, in the Text section. A text resized on its own keeps its size; the link icon in its menu joins it back.',
      'Rotate the selected text with the knob above it; Shift snaps to 15°, a double-click on the knob straightens it.',
      'Speech bubble tails can sit on either edge at each corner: four more spots.',
      'An empty panel can be a color of your choice: right-click it.',
      "Levels for a photo, like Krita's: set its input and output black and white points.",
      "Color balance for a photo, like Krita's: shift its shadows, midtones and highlights toward red, green or blue, with or without keeping its lightness.",
      'Levels and color balance for every photo at once, in the new Filters section of the sidebar; a photo can have local ones instead.',
      'Filters and overlays switched off keep their settings until the app is closed, so switching them back on restores them.',
      "The app's own color picker for custom colors, now also for text: drag for the color, or type its hex code.",
      'Blur a photo, or lay a color over it fading from the top or the bottom, with its angle, size and strength: right-click the photo.',
      "Turn the page border off for a single page from its right-click menu in the page strip. That page shows no page number; if it's the first page, it's a cover and numbering starts after it.",
      'Fixed: a right-click menu that grew while open could run off the bottom of the window.',
      'Patch notes, from the version number.',
      'A wider sidebar.',
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
