# 💚 Growing City Greens '26 — fund-the-need app

Repository: https://github.com/konstantinbrazhnik/citygreens-fundraiser-2026
Live: https://city-greens-fundraiser.juris-pbc.workers.dev

A one-link donation PWA for City Greens Market's 2026 fundraiser
(Tuesday, September 22, 2026 · Contemporary Art Museum St. Louis), built to be
scanned from a QR code or tapped from a text and to put every gift on a wall in
real time.

- **`/`** — land, read why (a grocery store for Dutchtown), tap **Donate**.
  Newsletter sign-up (Mailchimp, the same list as stlcitygreens.org) and a
  **Become a member** call to action are on the same page.
- **`/#/donate`** — preset amounts with a tangible outcome on each ($25 = a year
  of membership for an unemployed household … $1,000 = a founding gift toward
  opening the doors), or any amount. Name or anonymous, optional message,
  optional email for a Square receipt. Card, Apple Pay and Google Pay through
  Square's Web Payments SDK; the charge itself is made by the Worker with the
  Square Payments API.
- **`/#/board`** — the projector. Total, goal, progress, the latest gifts, a
  QR code to the donate link, a celebration card + confetti for every gift and
  gold rain at each 10% milestone. Sized in viewport units; hides the cursor.
- **`/#/admin`** — the organizer's desk (needs the `ADMIN_KEY` secret): put a
  paddle raise or check on the board by hand, move the goal, count money raised
  elsewhere, hide a mistaken gift, export a CSV of every gift and subscriber.

Everyone on `/` or `/#/donate` also sees a small "Maria G. just gave $100"
toast when a gift lands, so the room feeds itself.

## Stack

Same shape as the Batch 5 app: **Cloudflare Workers** + **Hono**, static
assets for the **Vite + React + Tailwind v4** PWA (vite-plugin-pwa), **D1** for
gifts/subscribers/settings, one **Durable Object** (`DonationBoard`) for
WebSocket fan-out with hibernation. Shared TypeScript in `shared/` is imported
by both the Worker and the app; the realtime message contract lives in
`shared/messages.ts`.

```
src/worker/   Hono API, Square client, Mailchimp client, DonationBoard DO
src/app/      React PWA (hash-routed screens in components/, hooks in lib/)
shared/       campaign copy, donation rules + presets, board folding, messages
migrations/   D1 schema
tests/        vitest unit (shared + router) and Workers integration (API + DO)
e2e/          Playwright golden path (land → give → see it on the board)
```

## Running it

```bash
npm install --legacy-peer-deps   # npm 10 trips on this peer graph; the flag only affects resolution
cp .dev.vars.example .dev.vars   # simulated payments + a local admin key
npm run migrate:local
npm run dev                       # http://127.0.0.1:8787
npm run test:ci                   # typecheck + unit + Workers integration
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e   # against `npm run dev`
```

`PAYMENTS_MODE=simulated` records gifts without charging anything (the form
shows a "Test mode" banner). It is what the tests and a rehearsal use. Set
`PAYMENTS_MODE=square` plus the Square variables below for real money.

## Deploying to Cloudflare

The Worker is deployed at https://city-greens-fundraiser.juris-pbc.workers.dev
with the D1 database, `ADMIN_KEY` and Square **sandbox** credentials in place
(`SQUARE_ENV` is `sandbox`, so cards are not really charged). Going live means
replacing the three `SQUARE_*` secrets with production ones and flipping
`SQUARE_ENV` back to `production`. The one-time setup, from a machine logged in to the
Cloudflare account (`npx wrangler login`, or `CLOUDFLARE_API_TOKEN` with
Workers + D1 edit scopes), was:

```bash
npx wrangler d1 create city-greens-fundraiser
#   → paste the printed database_id into wrangler.jsonc (d1_databases[0].database_id)

npx wrangler secret put SQUARE_ACCESS_TOKEN     # Square Developer Dashboard → Credentials
npx wrangler secret put SQUARE_APPLICATION_ID   # e.g. sq0idp-…
npx wrangler secret put SQUARE_LOCATION_ID      # the location the gifts post to
npx wrangler secret put ADMIN_KEY               # any long passphrase for #/admin

npm run deploy      # tests → build → migrate remote D1 → wrangler deploy
```

`scripts/cloudflare-setup.sh` does the same steps interactively.

Then in the Cloudflare dashboard attach a custom domain to the Worker
(e.g. `give.stlcitygreens.org`) — that is the URL to put in the QR code and
the text message. The board's QR code always points at whatever origin it is
served from, so it is right automatically.

Square notes:

- `SQUARE_ENV` is `production` in `wrangler.jsonc`. For a sandbox rehearsal
  set it to `sandbox` and use sandbox credentials; the SDK script and API host
  follow it.
- **Apple Pay** needs the domain registered under the Square application
  (Apple Pay → Add domain); Square then serves the verification file. Until
  then the Apple Pay button simply does not render; cards and Google Pay work.
- Receipts: when a donor gives an email, Square emails the receipt
  (`buyer_email_address`). The thank-you screen also links the receipt URL.
- Refunds/voids happen in the Square Dashboard; use **Hide** in `#/admin` to
  take the gift off the board.

## Content and branding

Copy, facts and links live in `shared/campaign.ts` and the gift presets in
`shared/donations.ts`. Voice and tone for all copy on the site is documented
in [`docs/VOICE.md`](docs/VOICE.md) — check it before writing new copy.
Colors come from the "Growing City Greens" poster
(deep green `#285038`, gold `#d8a850`, cream `#fff8dd`) and the City Greens
site theme (leaf `#558632`, peach `#e4a95b`). Fonts: Limelight for the deco
wordmark, Outfit (variable) for everything else, both self-hosted in
`src/app/public/fonts`. Nothing renders below 18px on a phone; the e2e test
asserts it.

The fundraising goal defaults to $100,000 (the announced Growing City Greens
goal) via `GOAL_CENTS`; change it live from `#/admin`.
