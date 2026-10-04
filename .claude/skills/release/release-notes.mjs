// Prints the GitHub release description for a version, from its entry in
// src/lib/patchNotes.ts (notes as bullets, sub-items nested), in the layout
// earlier releases use.
//   node .claude/skills/release/release-notes.mjs 1.2.0 > release-notes.md
import { readFileSync } from 'node:fs'

const version = process.argv[2]
if (!version) {
  console.error('Usage: node release-notes.mjs <version>')
  process.exit(1)
}

// patchNotes.ts is plain data; dropping its type annotations leaves JavaScript
const source = readFileSync(new URL('../../../src/lib/patchNotes.ts', import.meta.url), 'utf8')
  .replace(/export type [^\n]*\n/, '')
  .replace(/export const PATCH_NOTES:[^=]*=/, 'return')
const release = new Function(source)().find((r) => r.version === version)
if (!release) {
  console.error(`No patch notes for ${version} in src/lib/patchNotes.ts`)
  process.exit(1)
}

const notes = release.notes
  .map((n) => (typeof n === 'string' ? `- ${n}` : [`- ${n.text}`, ...n.sub.map((s) => `  - ${s}`)].join('\n')))
  .join('\n')

const file = (system) => `crop-tease-${version}-${system}`
console.log(`Crop and zoom your images into comic pages, with panels, close-ups and speech bubbles, all in your browser or offline.

**Use it in your browser:** https://www.blushingdefeat.com/play/crop-tease/

## What's new in ${version}

${notes}

## Downloads

| System | File |
|--------|------|
| Windows (installer) | \`${file('win-x64-setup.exe')}\` |
| Windows (portable, no install) | \`${file('win-x64-portable.exe')}\` |
| Linux | \`${file('linux-x86_64.AppImage')}\` (make it executable, then run it) |

The desktop apps work completely offline. The builds aren't code-signed, so Windows SmartScreen may warn you the first time you run them ("More info", then "Run anyway").`)
