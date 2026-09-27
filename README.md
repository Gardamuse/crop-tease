# Crop Tease

*Crop and zoom your photos into comic pages.*

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
and can be saved to or opened from a `.ct` project file.

## Scripts

```sh
npm install
npm run dev        # dev server
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run deploy     # build and upload to the server (see below)
```

`npm run deploy` and `npm run deploy:beta` copy the build to the web server
over SSH. The server is read from `DEPLOY_HOST=user@host`, set in the
environment or in `scripts/deploy.env` (git-ignored; copy
`scripts/deploy.env.example`).

### Desktop builds (offline)

The app can also be packaged with Electron, so it runs without a network.
Builds land in `release/`, named with the version from `package.json`
(e.g. `crop-tease-1.0.0-beta.1-linux-x86_64.AppImage`).

```sh
npm run electron     # build and run it in Electron
npm run dist:linux   # Linux AppImage
npm run dist:win     # Windows installer (-setup.exe) and portable .exe
npm run dist:all     # both
```

Windows builds can be made on Linux with Wine installed (it's used to set the
exe's icon and version info). Bump the version with
`npm version <version> --no-git-tag-version`; it also shows in the app's
corner. `electron/main.js` serves `dist/` from an `app://` origin, so storage,
fonts and the save dialog work as on the web.

## Layout

- `src/lib/`: framework-free logic
  - `layout.ts`: the split-bar tree (each bar cuts one convex region in two,
    its ends anchored to the border or an earlier bar) and the polygon geometry
    that turns it into panel clip paths
  - `imageFrame.ts`: cover-fit, pan and zoom for an image inside a box
  - `project.ts`: the versioned save format, autosave, and `.ct` save/open
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

A saved project is a `.ct` file: a zip archive (rename it to `.zip` to look
inside) containing `project.json` and `images/<id>.<ext>`.
The same JSON document is used for the browser autosave. It carries
`"format": "crop-tease"` and a `"version"` number.

To change the format:

1. bump `PROJECT_VERSION` in `src/lib/project.ts`,
2. add a `MIGRATIONS[previousVersion]` function that upgrades an old document
   to the new shape,
3. update `ProjectSchema`, `serializeProject` and `applyProject`,
4. update `public/crop-tease-skill.md`, the Claude skill describing the app
   and this format (downloadable from the How-to card).

Documents are upgraded one version at a time on load, so older saves (and old
autosaves) keep opening. Files from a newer version are refused with a
message rather than half-loaded.

## Fonts

The fonts in `public/fonts/` are third-party and keep their own licenses,
which sit next to each font file; they are not covered by this project's
license.

| Font | Author | License |
|------|--------|---------|
| Courier Prime Code (interface) | Quote-Unquote Apps | SIL Open Font License |
| Manrope (headings) | The Manrope Project Authors | SIL Open Font License |
| Comic Neue | The Comic Neue Project Authors | SIL Open Font License |
| Kalam | Indian Type Foundry | SIL Open Font License |
| Patrick Hand | Patrick Wagesreiter | SIL Open Font License |
| Solway | The Solway Project Authors | SIL Open Font License |
| Luckiest Guy | Astigmatic | Apache License 2.0 |
| White Rabbit | Matthew Welch | MIT-style (re-saved to fix a broken table; see its NOTES.txt) |
| Komika Hand | Apostrophic Laboratories | Freeware; may be redistributed only unmodified |
| Saiba 45 | Yuurin Bee | Free ("100% Free" on DaFont, no license file) |
| Bubbly | heyy! | Free ("100% Free" on DaFont, no license file) |
| Cloister Black | Dieter Steffmann | Free ("100% Free" on DaFont, no license file) |
| My Handwriting Sucks | 123etcetera | Free ("100% Free" on DaFont, no license file) |

For the DaFont fonts, a `LICENSE.txt` next to each records where it came
from and its status when it was added. Fonts users add themselves are kept
in their browser and packed into the `.ct` files that use them; they are
never part of this repository.

## License

Crop Tease is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See [LICENSE](LICENSE).

The bundled fonts are under their own licenses (see [Fonts](#fonts)).
