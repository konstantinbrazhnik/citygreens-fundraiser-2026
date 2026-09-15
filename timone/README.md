# 🐾 Timone — sitter's guide

A one-page, install-to-the-home-screen guide for whoever is watching Timone:
his routine, his food and pills, and who to call. It is a **separate Worker**
from the fundraiser app in this repo — static assets only, no code, no
bindings, nothing shared.

Live: https://timone.juris-pbc.workers.dev

## What's in it

Three tabs, one thumb, big type:

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
public/app.css               the theme: south-city brick, the blue foundation
                             course, limestone mortar, a little market green
public/app.js                tabs, the daily checklist, the SW registration
public/sw.js                 precache + cache-first, with a background refresh
public/manifest.webmanifest  name, colors and icons for the Home Screen
public/icons/mark.svg        the drawn portrait; every PNG is rendered from it
wrangler.jsonc               the assets-only Worker
```

## Working on it

```bash
npm run timone:dev      # http://127.0.0.1:8788
npm run timone:deploy   # publish
npm run timone:icons    # re-render the PNG icons after editing mark.svg
```

Edits reach a phone that already has the guide saved on its next online open:
the service worker serves the cached copy immediately and refreshes it in the
background, so the change shows up the time after that. To force every phone
to refetch at once, bump `VERSION` in `public/sw.js`.

## Using the real photo of him

Drop a photo at `public/photo.jpg` and deploy. The page checks for it at
startup and uses it in place of the drawn portrait; the service worker then
caches it like everything else. No code change needed. (The drawn mark stays
the app icon.)
