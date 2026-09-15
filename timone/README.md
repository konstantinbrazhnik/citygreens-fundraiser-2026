# 🐾 Timone — sitter's guide

A one-page, install-to-the-home-screen guide for whoever is watching Timone:
his routine, his food and pills, and who to call. It is a **separate Worker**
from the fundraiser app in this repo — static assets only, no code, no
bindings, nothing shared.

Live: https://timone.juris-pbc.workers.dev

## What's in it

Three tabs, one thumb, big type — paper, ink and one muted blue for anything
tappable:

- **Routine** — the morning/evening rhythm, a checklist that clears itself
  every morning (saved on the sitter's phone, nowhere else), and walks.
- **Food & Meds** — how much of what, and the two morning pills.
- **Contacts** — us, the vet (Banfield on Chippewa, tap to call), and how to
  save the guide to the Home Screen.

Everything is precached by `sw.js`, so once it has been opened one time it
works with no signal at all — on a walk, in a basement, in airplane mode.

## Files

```
public/index.html            all of the content
public/app.css               the styles
public/app.js                tabs, the daily checklist, the SW registration
public/sw.js                 precache + cache-first, with a background refresh
public/manifest.webmanifest  name, colors and icons for the Home Screen
public/photo.jpg             the header photo
public/icons/*.png           the Home Screen icons
photo-source.jpg             the original photo everything above is cut from
wrangler.jsonc               the assets-only Worker
```

## Working on it

```bash
npm run timone:dev      # http://127.0.0.1:8787
npm run timone:deploy   # publish
npm run timone:images   # re-cut photo.jpg and the icons from photo-source.jpg
```

`timone:images` crops with the Chromium that Playwright already ships, so
there is no image library to install. The crop rectangles are three constants
at the top of `scripts/timone-photo.mjs`: the header photo, his face for the
icons, and a wider face crop for the maskable icon (Android masks bite into
the edges). Replace `photo-source.jpg`, adjust those three, re-run.

Edits reach a phone that already has the guide saved on its next online open:
the service worker serves the cached copy immediately and refreshes it in the
background, so the change shows up the time after that. To force every phone
to refetch at once, bump `VERSION` in `public/sw.js`.
