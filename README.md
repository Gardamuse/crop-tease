# Split-Panel Comic Maker

A small Vue 3 + TypeScript + SCSS app for laying out comic pages. Split each
page into panels with divider bars (each bar hooks onto the page border or
onto other bars), drop a photo into each panel, add circular close-ups and
text (plain, speech bubble or caption box), then export a page as WebP or JPG
at any size (1600x2000 by default). A project can have several pages, which
share its page size and line settings; pages can be reordered, duplicated and
exported together, and an optional page number (`{n}` / `{total}`) appears on
every page.

Everything runs in the browser; nothing is uploaded. The current project
(images included) is autosaved to IndexedDB and reopened on the next visit,
and can be saved to or opened from a `.comic` project file.

## Scripts

```sh
npm install
npm run dev        # dev server
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## Layout

- `src/lib/`: framework-free logic
  - `layout.ts`: the split-bar tree (each bar cuts one convex region in two,
    its ends anchored to the border or an earlier bar) and the polygon geometry
    that turns it into panel clip paths
  - `imageFrame.ts`: cover-fit, pan and zoom for an image inside a box
  - `project.ts`: the versioned save format, autosave, and `.comic` save/open
  - `images.ts`: the project's images, keyed by content hash and mirrored to IndexedDB
  - `task.ts` / `saveFile.ts`: progress dialog and the "Save as" picker (with download fallback)
  - `store.ts`: reactive app state and actions: settings, pages (each with its
    own layout and elements; `store.layout` / `store.elements` always refer to
    the current page) and selection
  - `exportImage.ts`: clones the stage into an SVG foreignObject and rasterizes it
  - `pointer.ts`: window-level pointer drag tracking
- `src/components/`: `ComicStage` (fit-to-window stage), `ImagePanel`, `SplitBars`,
  `CloseUpCircle`, `TextBox`, `ElementHandle`, `ComicSidebar`
- `src/lib/constants.ts` explains the coordinate system: the page is edited in
  "stage units" where the shorter side is always 700, so layouts keep their
  proportions at any output size and the export scales the stage up.
- `src/scss/variables.scss` is injected into every component style block (variables and mixins only).

Editor-only chrome (handles, toolbars, bar hit areas) is marked with
`data-no-export` so the exporter strips it.

## Project files

A saved project is a `.comic` file: a zip archive (rename it to `.zip` to look
inside) containing `project.json` and `images/<id>.<ext>`.
The same JSON document is used for the browser autosave. It carries
`"format": "comic-maker"` and a `"version"` number.

To change the format:

1. bump `PROJECT_VERSION` in `src/lib/project.ts`,
2. add a `MIGRATIONS[previousVersion]` function that upgrades an old document
   to the new shape,
3. update `ProjectSchema`, `serializeProject` and `applyProject`.

Documents are upgraded one version at a time on load, so older saves (and old
autosaves) keep opening. Files from a newer version are refused with a
message rather than half-loaded.
