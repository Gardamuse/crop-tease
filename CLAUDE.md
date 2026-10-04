# Crop Tease

See README.md for how the app is built, packaged and deployed.

## Releases and patch notes

Clicking the version number in the app's corner opens its patch notes, kept in
`src/lib/patchNotes.ts` (newest release first). Whenever the version changes
or a release is built or deployed (`npm version`, `npm run deploy`,
`npm run dist:*`), first make sure the patch notes are up to date:

1. Find what changed since the last release: `git log` from the commit that
   set the previous version (e.g. "Version 1.1.0; ..."), plus any uncommitted
   work.
2. Make sure `PATCH_NOTES` has an entry whose `version` is exactly the one in
   `package.json` (e.g. `'1.1.0'`), at the top, covering every user-facing
   change: new features, changed behavior and fixes ("Fixed: ..."). Leave out
   internal changes users can't see (refactors, build and deploy tweaks).
3. Write each note as one short plain sentence, from the user's side, naming
   the controls and keys as the app shows them. A smaller change that belongs
   to a larger one goes under it as a sub-item (`{ text, sub: [...] }`),
   shown indented; one level only.

Bump the version with `npm version <version> --no-git-tag-version`, which
updates both `package.json` and `package-lock.json`. If you're asked to
release without the version or notes having been updated, point it out before
going ahead.
