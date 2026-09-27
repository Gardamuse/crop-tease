# Split-Panel Comic Maker

A small Vue 3 + TypeScript + SCSS app for laying out a comic page: split it
into panels with bars (each bar hooks onto the border or onto other bars),
drop an image into each panel, add circular close-ups, captions and speech
bubbles, then export a WebP or JPG at
any page size (1600x2000 by default).
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
  - `layout.ts`: the split-bar tree (each bar cuts one convex region in two,
    its ends anchored to the border or an earlier bar) and the polygon geometry
    that turns it into panel clip paths
  - `imageFrame.ts`: cover-fit, pan and zoom for an image inside a box
  - `store.ts`: reactive app state (seam, panel images, elements, selection) and actions
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
