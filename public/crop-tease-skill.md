---
name: crop-tease
description: Create comic page layouts as Crop Tease project files (.ct) that the user opens, renders and refines in the Crop Tease web app. Use when the user asks for a comic layout, comic page, panel layout or storyboard for Crop Tease, or hands over a .ct file to read or change.
---

# Crop Tease project files

<!-- A skill for AI agents and assistants. To install it in a tool that
supports skills (the SKILL.md format), save this file as SKILL.md in a
folder named crop-tease inside that tool's skills folder, or upload the
folder wherever the tool manages skills. With any other assistant, attach
this file to the chat or add it to the project's instructions. -->

Crop Tease is a browser app that turns photos into comic pages. Each page is
split into panels by straight divider bars; a photo fills each panel (panned
and zoomed inside it). On top of the panels sit circular close-ups (a photo
in a ringed circle) and text (plain, a speech bubble or a square caption
box). A project has one or more pages that share a page size, line settings
and font. The user exports pages as WebP/JPG images, a zip or a PDF.

Everything runs in the user's browser; nothing is uploaded. The app saves and
opens projects as `.ct` files, and that is how you hand work over: you write a
`.ct` file, the user opens it (folder button, "Open a saved .ct project"),
sees it rendered, drops in photos, drags things into place, and saves it
again. They can give you the saved file back so you can keep refining it.

Your job is usually the **layout and words**: page count, panel shapes, close-up
spots, speech bubbles, captions, sound effects. Leave panels empty (`frame:
null`) unless the user gave you the photos; empty panels show pastel
placeholder colors and the user fills them with a click or a drop.

## The .ct file

A `.ct` file is an ordinary zip archive (the extension is the only
difference) containing:

- `project.json`: the project document described below
- `images/<id>.<ext>`: one file per image the project uses (only if any)
- `fonts/<n>.<ext>`: the user's own fonts the project uses (only if any),
  listed in `fonts` in `project.json`; the app adds them to the user's browser
  when the file is opened

The app only reads `.ct` files through its Open button, so always write the
zip, named `<something>.ct`. To read one the user sends you, unzip it and read
`project.json`.

## Coordinates: stage units

Positions and sizes are in **stage units**, not output pixels. The page's
**shorter side is always 700 stage units**; the longer side follows the page's
aspect ratio. For the default 1600x2000 page, the stage is 700 x 875.

```
exportScale = min(pageWidth, pageHeight) / 700
stageW = pageWidth / exportScale
stageH = pageHeight / exportScale
```

Origin is the top-left corner, x to the right, y **down**. Text sizes are in
stage units too (a `fontSize` or `textSize` of 20 on a 1600x2000 page is
about 46 output pixels). If `textSize` is left out (as in projects from before
it existed), it is 20 and every text with a `fontSize` of exactly 20 follows it. The exceptions are the line widths in `border`, which are in output
pixels.

## project.json

```jsonc
{
  "format": "crop-tease",        // required, exactly this
  "version": 1,                  // required; the current format version
  "name": "comic",               // project name, used for exported file names
  "pageSize": { "width": 1600, "height": 2000 },  // output pixels, integers 200..8000
  "exportFormat": "webp",        // "webp" | "jpg"
  "border": {
    "width": 40,                 // page border, output px, 0..200 (0 = none)
    "dividerWidth": 20,          // divider bars and close-up rings, output px, 0..100
    "color": "#ffffff",          // fill of border, bars and rings: #rrggbb only
    "outlineColor": "#000000",   // thin line along both sides of them: #rrggbb or null for none
    "outlineWidth": 2            // output px, 1..10
  },
  "closeUps": {
    "shadow": true,              // drop shadow under close-ups
    "withinBorder": false        // true: clip close-ups at the inner edge of the page border
  },
  "textFont": "classic",         // font of all text (see Fonts)
  "textSize": 20,                // size of text without its own fontSize, stage units
  "photoFilters": {              // optional: levels, color balance and color splash for every photo without its own
    "levels": null, "colorBalance": null, "colorSplash": null   // same shapes as a photo's (see Blur and color overlay), or null
  },
  "pages": [ /* at least one page, see Pages */ ],
  "currentPage": 0,              // index of the page shown when opened
  "pageNumber": null,            // a text element shown on every page, or null (see Page numbers)
  "images": [],                  // every image used: [{ "id": "...", "type": "image/jpeg" }]
  "fonts": []                    // optional: user fonts packed in the file: [{ "name": "Font Name", "file": "fonts/1.ttf" }]
}
```

Common page sizes: 1600x2000 (4:5 portrait, the default), 1600x2400 (2:3
portrait), 2000x2000 (square), 2400x1600 (3:2 landscape), 1920x1080 (16:9).

### IDs

Every page, panel (leaf), bar and element has an integer `id`, and **ids must
be unique across the whole project** (all pages, plus the page number). Just
count up from 1 as you create things. Unknown keys are ignored and missing
required keys make the file fail to open, so include every field shown.

## Pages

```jsonc
{
  "id": 1,
  "layout": { /* region tree, see Panels and bars */ },
  "elements": [ /* close-ups and text, see Elements */ ],
  "border": true   // optional: false leaves the page border and the page number off this page
}
```

## Panels and bars

A page's `layout` is a binary tree. A **leaf** is one panel:

```jsonc
{ "kind": "leaf", "id": 2, "frame": null }   // frame: a photo (see Photos) or null
```

A panel without a photo shows a flat color: `"fill": "#20304a"` (#rrggbb),
or a pastel placeholder color if it's null or missing. Exports show it too,
so set a fill (e.g. white or black) on panels meant to stay empty.

A **split** cuts a region in two with one straight bar:

```jsonc
{
  "kind": "split",
  "bar": { "id": 3, "a": { "host": "border", "t": 0.5 }, "b": { "host": "border", "t": 2.5 } },
  "front": { /* region on one side */ },
  "back":  { /* region on the other side */ }
}
```

The root region is the whole page. Each split cuts the region it sits in (a
convex polygon) along the straight line from end `a` to end `b`, so every
panel is a convex polygon. A single-panel page is just a leaf.

**Anchors** (`a` and `b`) say where a bar's ends are:

- `{ "host": "border", "t": ... }`: a point on the page edge. `t` walks the
  perimeter clockwise in [0, 4), one unit per side, proportionally along it:
  - 0 to 1: top edge, left to right (0 = top-left corner, 0.5 = top middle)
  - 1 to 2: right edge, top to bottom (1.5 = right middle)
  - 2 to 3: bottom edge, **right to left** (2.5 = bottom middle, 2.75 = a quarter from the left)
  - 3 to 4: left edge, **bottom to top** (3.5 = left middle, 3.25 = a quarter up from the bottom)
- `{ "host": <bar id>, "t": ... }`: a point on an earlier bar (an ancestor
  split), `t` from 0 at that bar's `a` end to 1 at its `b` end. Use this to
  make a bar that stops at another bar (a T-junction).

Because anchors are proportional, a layout keeps its shape at any page size.

Each end must lie on the boundary of the region being cut: the page border
or a bar that bounds that region. The app snaps each end to the nearest point
of that region's boundary, so an anchor that is slightly off still works, but
a bar anchored on something that isn't that region's edge lands somewhere
unexpected. The two ends must not lie on the same edge, and the bar should be
at least 30 stage units long.

**Which side is `front`:** with the bar's direction d = b - a (screen
coordinates, y down), `front` is the side that the vector (-d.y, d.x) points
to. Concretely:

| bar runs            | front is | back is |
|---------------------|----------|---------|
| top to bottom       | left     | right   |
| left to right       | below    | above   |
| bottom to top       | right    | left    |
| right to left       | above    | below   |

Reading order is up to you; the app doesn't care about panel order. Diagonal
bars are fine and give comics a dynamic look: e.g. a bar from `t: 3.6` (left
edge, upper) to `t: 1.45` (right edge, a bit lower) slants across the page.

### Example: three rows, the middle one split in two

```jsonc
{
  "kind": "split",                                     // bar 10: left edge -> right edge, one third down
  "bar": { "id": 10, "a": { "host": "border", "t": 3.6667 }, "b": { "host": "border", "t": 1.3333 } },
  "back": { "kind": "leaf", "id": 11, "frame": null }, // above bar 10: top row
  "front": {
    "kind": "split",                                   // bar 12: left edge -> right edge, two thirds down
    "bar": { "id": 12, "a": { "host": "border", "t": 3.3333 }, "b": { "host": "border", "t": 1.6667 } },
    "front": { "kind": "leaf", "id": 13, "frame": null }, // below bar 12: bottom row
    "back": {
      "kind": "split",                                 // bar 14: from bar 10 down to bar 12, 40% across
      "bar": { "id": 14, "a": { "host": 10, "t": 0.4 }, "b": { "host": 12, "t": 0.4 } },
      "front": { "kind": "leaf", "id": 15, "frame": null }, // left of bar 14
      "back": { "kind": "leaf", "id": 16, "frame": null }   // right of bar 14
    }
  }
}
```

The border, bars and rings are drawn in `border.color` with the outline on
both sides, and they sit on top of the photos, so the visible gutter between
panels is `dividerWidth` output pixels wide.

## Elements

`elements` holds a page's close-ups and text boxes. `z` orders them: a higher
`z` draws on top. Use small integers (e.g. 11, 12, 13...). Elements may
extend past panel edges and over the bars; that's often the point.

### Close-up (circle)

```jsonc
{
  "id": 20, "kind": "circle",
  "x": 420, "y": 300,   // top-left of the circle's bounding square, stage units
  "d": 200,             // diameter, stage units (the app's handles allow 60..700)
  "z": 11,
  "frame": null         // a photo (see Photos) or null for a placeholder
}
```

The ring (`dividerWidth` wide, in `border.color`, with the outline) is drawn
around the outside of the diameter.

### Text

```jsonc
{
  "id": 21, "kind": "text",
  "style": "speech",     // "none" | "speech" | "square"
  "tail": "bottom-left", // speech bubbles only: the edge it points out of, then which end:
                         //   "top-left" | "top" | "top-right" | "right-top" | "right" |
                         //   "right-bottom" | "bottom-right" | "bottom" | "bottom-left" |
                         //   "left-bottom" | "left" | "left-top"
  "x": 60, "y": 60,      // top-left of the box before rotation, stage units
  "w": 260, "h": 90,     // box size, stage units (the app's handles allow at least 60 x 30)
  "rot": 0,              // rotation in degrees, clockwise, about the box's center
  "text": "Line one\nline two", // plain text; \n for line breaks
  "fontSize": null,      // null = the project's textSize, or this text's own size in stage units
                         //   (output px = size * exportScale)
  "color": "#241b30",    // text color, any CSS color (hex recommended)
  "outline": true,       // style "none" only: thin black/white outline for contrast
  "font": null,          // null = the project's textFont, or a font id for this text alone
  "z": 12
}
```

Styles:

- `speech`: white rounded bubble with a dark 4-unit border; text centered both
  ways; padding 16/20 units (vertical/horizontal). The tail points outward from
  the named edge, at its middle or near one end (26 units in from the corner:
  "bottom-left" points down near the left end, "left-bottom" points left near
  the bottom end) and
  sticks out about 28 units: point it at the speaker.
- `square`: white caption box with a dark border; text left-aligned from the
  top, padding 14/18; in the classic font it's a serif italic. Good for
  narration ("Meanwhile...").
- `none`: just the letters, centered horizontally from the top, padding 4/6,
  with a thin outline that contrasts with `color` when `outline` is true. Good
  for sound effects and titles; try a big `fontSize`, a bright color and a
  slight `rot`.

Text that doesn't fit is cut off at the box edge, so size boxes generously:
roughly, one line is `1.25 * fontSize` tall, and a character is about
`0.55 * fontSize` wide in the classic font. Add the padding and the border.

Text color palette used by the app: `#241b30` (ink), `#ffffff`, `#ff6fb0`,
`#78d2d2`, `#de3c8d`.

### Page numbers

`pageNumber` is one text element (same shape as above, usually
`style: "none"`), drawn at the same place on every page, with `{n}` in its
text replaced by the page number and `{total}` by the page count:

```jsonc
"pageNumber": {
  "id": 99, "kind": "text", "style": "none", "tail": "bottom-left",
  "x": 290, "y": 795, "w": 120, "h": 50, "rot": 0, "z": 10,
  "text": "{n} / {total}", "fontSize": null, "color": "#ffffff", "outline": true, "font": null
}
```

Pages with `"border": false` don't show it. If the first page has
`"border": false`, it's a cover and isn't counted: the page after it is
number 1, and `{total}` leaves it out. Later borderless pages still count.

## Fonts

`textFont` (and a text's own `font`) is one of these ids:

| id | look |
|----|------|
| `classic` | heavy system sans; square captions in serif italic (default) |
| `comic-neue` | Comic Neue Bold, clean comic lettering |
| `komika` | Komika Hand, classic comic-book hand lettering |
| `luckiest-guy` | Luckiest Guy, chunky cartoon display (sound effects, titles) |
| `patrick-hand` | Patrick Hand, casual handwriting |
| `kalam` | Kalam Bold, marker handwriting |
| `my-handwriting-sucks` | scrawly handwriting |
| `bubbly` | Bubbly, round and cute |
| `solway` | Solway Bold, soft slab serif |
| `saiba-45` | Saiba 45, sci-fi display |
| `white-rabbit` | White Rabbit, monospaced terminal |
| `cloister-black` | Cloister Black, blackletter |

Fonts the user added themselves are `custom:<font name>`. An id the app
doesn't know is kept, and the text is drawn in the classic font with a
warning until the user adds that font. A `.ct` file saved by the app packs
the user fonts it uses (`fonts` above), so keep those entries and files when
you change a file the user gave you; don't invent font files yourself.

## Photos (frames)

Only fill `frame` when you have the actual image files to pack into the
`.ct`. A frame places one image inside a panel or close-up:

```jsonc
{
  "imageId": "3f6c...",  // matches images[].id and the file images/<id>.<ext>
  "natW": 3000, "natH": 2000,  // the image's pixel size
  "baseScale": 0.41,     // the "cover" scale for its box; zoom is limited to 0.1x..5x of this
  "scale": 0.41,         // current scale (image pixels -> stage units)
  "tx": -265, "ty": 0,   // where the image's top-left corner lands (before rotation)
  "mirror": false,       // optional: true flips the image left to right, in the same spot
  "rotation": 0          // optional: degrees clockwise the image is turned about its own middle, -180..180
}
```

The image is drawn at `translate(tx, ty) scale(scale)` from its top-left and
clipped to the panel or circle.

- **Panels**: `tx`/`ty` are page stage coordinates. To cover the panel, take
  its bounding box (bx, by, bw, bh) in stage units: `baseScale = scale =
  max(bw / natW, bh / natH)`, `tx = bx + (bw - natW * scale) / 2`,
  `ty = by + (bh - natH * scale) / 2`.
- **Close-ups**: `tx`/`ty` are relative to the circle's top-left, and the box
  is d x d: `scale = max(d / natW, d / natH)`, `tx = (d - natW * scale) / 2`,
  and likewise `ty`.

To zoom in on a detail, raise `scale` above `baseScale` and shift `tx`/`ty`
so the detail is centered. The user can always pan and zoom by hand, so an
approximate cover fit is fine.

Image ids are any string that's safe in a file name; the app uses the first
32 hex digits of the file's SHA-256. List every used image in `images` with
its MIME type (`image/jpeg`, `image/png`, `image/webp`, `image/gif`,
`image/avif`) and store it as `images/<id>.<ext>` (`jpg`, `png`, `webp`,
`gif`, `avif`). A frame whose image is missing shows a placeholder.

### Blur and color overlay

A panel leaf or a close-up can also carry effects on its photo (both
optional; they only show while it has a photo, and stay if it changes):

```jsonc
"blur": 8,               // blur radius in output pixels, 0..50 (0 or missing: none)
"levels": {              // or null / missing to use the project's photoFilters, "none" for none; all 0..255, per channel
  "inLow": 20, "inHigh": 235,  // these input tones become black and white (inLow < inHigh), beyond clipped
  "outLow": 0, "outHigh": 255  // then fitted into this output range
},
"colorBalance": {        // or null / missing to use the project's photoFilters, "none" for none; as in Krita, each range is
                         //   [cyan..red, magenta..green, yellow..blue], each -40..40
  "shadows": [0, 0, 10], "midtones": [5, 0, 0], "highlights": [8, 0, -5],
  "preserveLuminosity": true   // keep each pixel's lightness, shift only its color
},
"colorSplash": {         // or null / missing to use the project's photoFilters, "none" for none: the photo turned gray
                         //   except for one range of hues on the color wheel
  "hue": 0,              // the kept colors' hue, 0..359 degrees (0 red, 60 yellow, 120 green, 240 blue)
  "width": 60,           // how wide a range of hues around it is kept, 10..300 degrees
  "softness": 50,        // how gradually the kept range fades into gray at its edges, 0..100 %
  "desaturate": 100      // how gray everything else gets, 0..100 %
},
"overlay": {             // a color fading over the photo, or null / missing for none
  "from": "bottom",      // "top" | "bottom": the side it fades from
  "angle": 0,            // degrees clockwise the fade is turned, -90..90
  "color": "#000000",    // #rrggbb
  "size": 100,           // how far the fade reaches, % of the photo
  "strength": 100        // the color's opacity where it's strongest, %
}
```

A black `"bottom"` overlay is a good backdrop for captions at the foot of a
panel.

## Building the file

A small Python script is the easiest way. This one writes a two-page project
with empty panels; extend `pages` as needed:

```python
import json, zipfile

W, H = 1600, 2000
scale = min(W, H) / 700
SW, SH = W / scale, H / scale  # stage size: 700 x 875

next_id = 0
def nid():
    global next_id
    next_id += 1
    return next_id

def leaf():
    return {"kind": "leaf", "id": nid(), "frame": None}

def border(t):
    return {"host": "border", "t": t}

def text(x, y, w, h, s, style="speech", tail="bottom-left", size=None, z=12, **kw):
    return {"id": nid(), "kind": "text", "style": style, "tail": tail, "x": x, "y": y, "w": w, "h": h,
            "rot": 0, "text": s, "fontSize": size, "color": "#241b30", "outline": True, "font": None,
            "z": z, **kw}

def two_rows():
    bar = nid()
    return {"kind": "split",
            "bar": {"id": bar, "a": border(3.5), "b": border(1.5)},  # left middle -> right middle
            "back": leaf(),   # top
            "front": leaf()}  # bottom

def row_then_two():
    top_bar = nid()
    mid_bar = nid()
    return {"kind": "split",
            "bar": {"id": top_bar, "a": border(3.55), "b": border(1.4)},  # slanted row divider
            "back": leaf(),
            "front": {"kind": "split",
                      "bar": {"id": mid_bar, "a": {"host": top_bar, "t": 0.6}, "b": border(2.45)},
                      "front": leaf(), "back": leaf()}}

pages = []
for layout, elements in [
    (two_rows(), [text(40, 40, 240, 80, "Where is\neveryone?", tail="bottom-right")]),
    (row_then_two(), [{"id": nid(), "kind": "circle", "x": 470, "y": 250, "d": 180, "z": 11, "frame": None},
                      text(250, 620, 200, 70, "BOOM!", style="none", size=48, z=13, color="#ff6fb0", rot=-8)]),
]:
    pages.append({"id": nid(), "layout": layout, "elements": elements})

doc = {
    "format": "crop-tease", "version": 1, "name": "my comic",
    "pageSize": {"width": W, "height": H}, "exportFormat": "webp",
    "border": {"width": 40, "dividerWidth": 20, "color": "#ffffff", "outlineColor": "#000000", "outlineWidth": 2},
    "closeUps": {"shadow": True, "withinBorder": False},
    "textFont": "komika", "textSize": 20,
    "pages": pages, "currentPage": 0,
    "pageNumber": None,
    "images": [],
}

with zipfile.ZipFile("my-comic.ct", "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("project.json", json.dumps(doc, indent=2))
    # with photos: z.write(path, f"images/{image_id}.jpg") for each image, and list it in doc["images"]
```

Take a bar's id before building its children (as `row_then_two` does), so
child bars can hook onto it.

Before handing the file over, check: ids unique, every page has a `layout`,
anchors on bars refer to an ancestor bar, colors in `border` are `#rrggbb`,
page size within 200..8000, and text boxes big enough for their words.

## Working with the user

- Plan the story first: how many pages, what happens in each panel, where
  speech goes. Vary panel sizes; give the big moment a big (or slanted)
  panel, and use close-ups for reactions and details.
- Put speech bubbles near the top of panels and in reading order (left to
  right, top to bottom), with tails pointing at speakers. Leave room for
  the faces the user will drop in.
- Tell the user to open the `.ct` in Crop Tease, fill the panels with photos,
  adjust, and save it again with the save button. Anything you can't know
  (where faces are in their photos) they fix by dragging.
- When they send a saved `.ct` back, unzip it, read `project.json`, change
  what they asked for, and keep everything else (including `images/` and
  every frame) exactly as it was. Keep ids stable; new things get ids above
  the current maximum.
- Files are refused if `version` is higher than the app knows; this document
  describes version 1.
