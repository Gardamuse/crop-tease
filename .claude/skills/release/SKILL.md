---
name: release
description: Release a version of Crop Tease (e.g. "release 1.3.0", "ship it", "publish the release"). Deploys the web app, builds the desktop apps, tags and pushes, and creates the GitHub release with the builds. Also covers beta deploys.
---

# Releasing Crop Tease

After the checks, a release has four parts, in this order, each checked
before the next: the web app deployed, the desktop apps built, a git tag
pushed with `main`, and a GitHub release with the desktop builds. Run from
the repository root.

## 1. Before anything goes out

- The working tree is clean and on `main` (`git status -sb`).
- `package.json`'s `version` is the version being released. If not, bump it
  with `npm version <version> --no-git-tag-version` and commit it as
  "Version <version>; <headline changes>".
- `src/lib/patchNotes.ts` has an entry for exactly that version, at the top,
  covering every user-facing change since the last release tag
  (`git log --oneline <last tag>..HEAD`). Follow `CLAUDE.md`'s patch note
  rules and the patch-notes skill. If the version or notes weren't updated,
  say so before going on.
- Commits after the notes were written count too: check them for anything
  user-facing.

## 2. Deploy the web app

```sh
npm run deploy
```

This type-checks, builds for the production URL and uploads `dist/` over SSH
(`scripts/deploy.sh prod`, configured in the git-ignored
`scripts/deploy.env`). Harmless noise: zod's "annotation that Rollup cannot
interpret" warnings and SSH's "post-quantum key exchange" warnings.

Then check the live site serves this build and version:

```sh
source scripts/deploy.env
curl -s "$PROD_BASE_URL" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'   # same name as in dist/assets/
curl -s "$PROD_BASE_URL<that path>" | grep -o '<version>' | head -1
```

## 3. Build the desktop apps

```sh
npm run dist:all
```

Takes a few minutes; Windows builds need Wine. It makes, in `release/`
(git-ignored):

- `crop-tease-<version>-linux-x86_64.AppImage`
- `crop-tease-<version>-win-x64-setup.exe` (plus a `.blockmap`, not uploaded)
- `crop-tease-<version>-win-x64-portable.exe`

Check all three exist with today's date.

## 4. Tag and push

An annotated tag on the release commit, then `main` and the tag:

```sh
git tag -a v<version> -m "Crop Tease <version>"
git push origin main
git push origin v<version>
```

## 5. GitHub release

The description comes from the patch notes, in the layout earlier releases
use (intro, browser link, "What's new", downloads table, SmartScreen note):

```sh
node .claude/skills/release/release-notes.mjs <version> > <scratch>/release-notes.md
gh release create v<version> --verify-tag --title "Crop Tease <version>" \
  --notes-file <scratch>/release-notes.md --latest \
  release/crop-tease-<version>-win-x64-setup.exe \
  release/crop-tease-<version>-win-x64-portable.exe \
  release/crop-tease-<version>-linux-x86_64.AppImage
```

Read the generated notes before creating the release. Then check the files
uploaded in full and the release is the latest (`gh release view` has no
`isLatest` field; `gh release list` shows "Latest"):

```sh
gh release view v<version> --json assets --jq '.assets[] | "\(.name) \(.size) \(.state)"'
ls -l release/crop-tease-<version>-*     # sizes should match
gh release list --limit 2
```

## Betas

A beta (e.g. `1.3.0-beta.1`) gets its version bump and patch notes like a
release. Betas so far got no tag or GitHub release; deploy one with
`npm run deploy:beta` (to the beta URL in `scripts/deploy.env`). When the
final version ships, its notes merge the betas' into one entry (see the
patch-notes skill).

## Report

Say what went out and how each part was checked: the live site's version,
the three build files, the tag and push, and the release URL with its
uploaded files.
