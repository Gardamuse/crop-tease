# Split-Panel Comic Maker

A small Vue 3 + TypeScript + SCSS app for laying out a two-panel comic page:
drag a diagonal seam around the border, drop an image into each half, add
circular close-ups, captions and speech bubbles, then export a 1600x2000 PNG.
Everything runs in the browser; nothing is uploaded.

## Scripts

```sh
npm install
npm run dev        # dev server
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## Layout

- `src/lib/`: framework-free logic
  - `seam.ts`: perimeter geometry for the seam and panel clip paths
  - `imageFrame.ts`: cover-fit, pan and zoom for an image inside a box
  - `store.ts`: reactive app state (seam, panel images, elements, selection) and actions
  - `exportPng.ts`: clones the stage into an SVG foreignObject and rasterizes it
  - `pointer.ts`: window-level pointer drag tracking
- `src/components/`: `ComicStage` (fit-to-window stage), `ImagePanel`, `SeamLine`,
  `CloseUpCircle`, `TextBox`, `ElementHandle`, `ComicSidebar`
- `src/scss/variables.scss` is injected into every component style block (variables and mixins only).

Editor-only chrome (handles, toolbars, the seam hit line) is marked with
`data-no-export` so the exporter strips it.
