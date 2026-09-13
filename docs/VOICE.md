# Voice & copy guide — Growing City Greens '26

This is the working style guide for copy on this site. It exists so future
copy (new presets, new screens, admin-authored strings) sounds like it came
from the same person who wrote the rest of the app.

It's built from real edits, not invented up front: each entry below traces
back to an actual before/after from a review round, dated, with the
principle it teaches. When writing new copy, check it against the
principles first; if a new situation isn't covered, match the *tone* of the
closest example rather than guessing.

Copy itself lives in [`shared/campaign.ts`](../shared/campaign.ts) (event
details, org info, page copy) and [`shared/donations.ts`](../shared/donations.ts)
(gift preset amounts + impact lines). This doc is about *how* to write it,
not a duplicate of the strings themselves.

## Principles

- **Frame the campaign as ongoing, not a one-time milestone.** Prefer
  "continue to grow" / "keep building" over "open a store" — the store
  opening is one moment in a longer effort, and the copy should read that
  way even on the page that's raising money for that specific moment.
- **Reach for "community-powered food system" over "grocery store."**
  The system (membership, at-cost pricing, local sourcing) is the story;
  the store is one expression of it.
- **Default to city-wide identity ("St. Louis") in top-level framing,
  not the neighborhood name.** Save "Bevo Mill" and other neighborhood
  specifics for supporting copy (subheads, impact lines) where the
  concrete detail earns its place.

## Edit log

Each entry: the round's date, the file/line touched, before → after, and
the principle it demonstrates.

### 2026-09-13 — shared/campaign.ts (`CAMPAIGN.headline`)
- **Before:** "Help open a grocery store in Bevo Mill."
- **After:** "Help us continue to grow a community-powered food system in
  St. Louis."
- **Principle:** ongoing effort > one-time milestone; food system > grocery
  store; city-wide identity > neighborhood name in top-level framing.

### 2026-09-13 — src/app/components/Home.tsx (hero date/venue kicker)
- **Before:** "Tuesday, September 22, 2026 · The CAM"
- **After:** "Tuesday, September 22, 2026"
- **Principle:** trim the hero kicker to what a first-time reader needs in
  the first second — the date. Venue name is secondary detail; it doesn't
  need to compete for space in the top-level hero line (it's still
  available further down the page).

### 2026-09-13 — running total / progress bar, site-wide
Not a copy edit — a feature change, noted here because it affects what the
site is allowed to imply. Turned off the running total, goal progress bar,
percent, and milestone celebrations everywhere they appeared (top bar, home
page, projector board, thank-you screen), behind a new `showTotal` setting
(default off, toggle in `#/admin`) rather than deleting the feature.
- **Why:** the event has verbal/off-app pledges this site's total can't
  capture. A total that reads lower than the real room total actively
  discourages giving — showing no total is better than showing a wrong one.
- **Principle:** individual named gifts (the recent-gifts feed, per-gift
  toasts and confetti) are not the same claim as an aggregate total, and
  don't carry the same risk — they stayed. Only the aggregate figure and
  anything computed from it (percent, "$X to go", milestone crossings) came
  down. When a display makes a claim the data can't back up, prefer hiding
  it over showing a plausible-looking wrong number.

### 2026-09-13 — src/app/components/Home.tsx (hero subhead)
- **Before:** "A neighborhood with no grocery store. A market that sells
  local food at cost. Tonight, we bring them together."
- **After:** "Your support directly contributes to expanding food access
  for all in our community."
- **Principle:** speak to the donor's impact directly ("your support...")
  rather than only describing the problem/solution in the third person.

### 2026-09-13 — src/app/components/Home.tsx (hero payment-methods line)
- **Before:** "Takes about a minute. Card, Apple Pay or Google Pay."
- **After:** "Takes about a minute. Donate via credit card, Apple Pay, or
  Google Pay."
- **Principle:** name the action ("Donate via...") rather than listing
  payment methods as a fragment; use the Oxford comma in three-item lists.

### 2026-09-13 — src/app/components/Home.tsx ("Tonight's event" card)
Removed the whole card (date/time, venue, address, "Tickets & event page"
link) from the home page. Not a copy edit — a content decision, not a voice
one; noted here for the record only.

### 2026-09-13 — src/app/components/Home.tsx ("Become a member" card)
- **Before:** "...and a sliding scale that starts at $25 a year."
- **After:** "...and a sliding member scale that starts at $25 a year."
- **Principle:** a wording preference, not a broader rule — noted here for
  the record. (The same "sliding scale" phrase also appears on the
  Thanks screen, not changed unless flagged separately.)

### 2026-09-13 — src/app/components/Home.tsx (section heading)
- **Before:** "Why Bevo Mill, why now"
- **After:** "Why give to City Greens Market?"
- **Principle:** frame section headings as the donor's question, not a
  place/time hook — "why give" over "why here/now."

### 2026-09-13 — src/app/components/Home.tsx ("Why give to City Greens Market?" story)
Removed the first paragraph ("Bevo Mill is one of the densest
neighborhoods..."). Content trim, not a voice principle — noted for the
record.

### 2026-09-13 — standing rule: "Bevo Mill" → "Dutchtown"
Every reference to the new store's neighborhood is now "Dutchtown," not
"Bevo Mill" — applied site-wide (`shared/campaign.ts`'s `CAMPAIGN.neighborhood`
and `story`, `shared/donations.ts` preset outcomes, the PWA manifest
description, `index.html` meta tags, and the Board/Donate/Thanks screens).
This is a **standing content rule going forward**, not a one-off edit — any
new copy that names the target neighborhood should say Dutchtown.
(`ORG.neighborhood` = "The Grove," the existing store's neighborhood, is
unrelated and unchanged.)

### 2026-09-13 — shared/campaign.ts (`CAMPAIGN.story[0]`)
- **Before:** "City Greens Market has spent 17 years proving a different
  model works in The Grove: buy from local farmers at a fair price, sell it
  at cost to members, and let a sliding scale make room for everyone."
- **After:** "For the past 18 years, City Greens Market has made fresh,
  local food more accessible and affordable for families while supporting
  the farmers who grow it. City Greens buys from local farmers at a fair
  price, sells food to members at cost, and uses a sliding membership scale
  so everyone can afford to buy groceries."
- **Principle:** lead with the mission/outcome (accessible, affordable food;
  support for farmers) before the mechanics (how the model works). 18 years
  also corrects the org's founding year math (`ORG.founded` = 2008).

### 2026-09-13 — shared/campaign.ts (`CAMPAIGN.story[1]`, new `story[2]`)
- **Before:** "This year we are taking that model to South City. Every
  dollar raised tonight goes toward opening the doors of a second City
  Greens in Dutchtown: shelves, coolers, a walk-in, and the first season of
  local food on them."
- **After:** "City Greens is working to bring fresh, affordable food to
  more St. Louis neighborhoods through online ordering and grocery
  delivery, while laying the groundwork for an expansion into Dutchtown."
  Plus a new short paragraph after it: "Your support makes this possible."
- **Principle:** avoid a fixed timeframe ("this year," "tonight") for work
  that's still in motion — describe it as ongoing ("is working to...")
  rather than pinned to an event date. A short, standalone sentence can
  land harder than folding the same idea into the paragraph above it.

### 2026-09-13 — src/app/components/Home.tsx ("Become a member" button)
- **Before:** "Join City Greens"
- **After:** "Join City Greens today!"
- **Principle:** CTAs get a little urgency/warmth ("today!") rather than
  staying flat/neutral.

### 2026-09-13 — shared/campaign.ts (`CAMPAIGN.story[0]`, second sentence)
- **Before:** "City Greens buys from local farmers at a fair price, sells
  food to members at cost, and uses a sliding membership scale so everyone
  can afford to buy groceries."
- **After:** "We buy from local farmers at a fair price, sell food to our
  members at cost, and use a sliding membership scale so everyone can
  afford to buy groceries."
- **Principle:** first person ("we"/"our") over third person for the org
  describing its own actions — reads warmer, less like a press release.

### 2026-09-13 — shared/campaign.ts (`CAMPAIGN.story[1]`, small fix)
- **Before:** "...laying the groundwork for an expansion into Dutchtown."
- **After:** "...laying the groundwork for our expansion into Dutchtown."
- **Principle:** same as above — "our" over "an" keeps first person
  consistent within a paragraph, not just across paragraphs.

### 2026-09-13 — src/app/components/Home.tsx (impact stats grid)
Removed the four-stat grid (500+ households, 100 farmers, ~0% food waste,
50% off SNAP produce) that sat under "Your support makes this possible."
Not a wording edit — a content decision: impact/proof stats will be
communicated another way during the event, and this page should instead
focus attention on what a donor's own gift directly does. That job now
falls entirely to "What your gift does" (the preset amounts + outcomes),
which follows immediately after. `CAMPAIGN.proof` in shared/campaign.ts is
left as-is (unused, not deleted) in case it's wanted again later.

### 2026-09-13 — src/app/components/Home.tsx (new section heading)
Added "Let's keep in touch" directly above the newsletter card, styled to
match the other section headings ("Why give to City Greens Market?",
"What your gift does") — same `text-[1.9rem] font-black leading-tight`,
no explicit color class, inheriting the page's default cream/white text.
- **Principle:** every major page section gets a heading in this same
  style; a card should not just appear without one.

### 2026-09-13 — src/app/components/Home.tsx (newsletter heading wording)
- **Before:** "Let's keep in touch"
- **After:** "Let's stay connected"
- **Principle:** a wording preference, not a broader rule — noted for the
  record.

### 2026-09-13 — shared/donations.ts ($500 preset outcome)
- **Before:** "Stocks a shelf of local food in the new Dutchtown store"
- **After:** "Stocks a shelf of local food in the market"
- **Principle:** preset outcomes in this list never end in a period —
  confirmed with the user after an initial edit added one by mistake.

### 2026-09-13 — shared/donations.ts ($250 preset outcome)
- **Before:** "Doubles $250 of fresh produce bought with SNAP"
- **After:** "Doubles $250 of fresh produce for neighbors shopping with SNAP"
- **Principle:** name the people the outcome serves ("neighbors") rather
  than describing the transaction alone.

### 2026-09-13 — shared/donations.ts ($100 preset outcome)
- **Before:** "Four $25 gift cards on the Give-a-Bag wall"
- **After:** "Provides four $25 Give-a-Bag/Take-a-Bag gift cards to
  neighbors in need"
- **Principle:** same as above — name who the outcome serves, and lead
  with the verb ("Provides...").

### 2026-09-13 — shared/donations.ts ($1,000 preset outcome)
- **Before:** "A founding gift toward opening the doors in Dutchtown"
- **After:** "Founding gift toward opening the doors in Dutchtown"
- **Principle:** a wording preference, not a broader rule — noted for the
  record.

### 2026-09-13 — shared/donations.ts ($500 preset icon)
- **Before:** 🏗️ (construction crane)
- **After:** 🥬 (leafy greens)
- **Why:** requested a "grocery store shelf with produce on it" icon —
  Unicode has no dedicated shelf/produce-shelf emoji, so 🥬 stands in as
  the closest available fresh-produce symbol, kept distinct from the 🥕
  already used on the $250 tier.

### 2026-09-13 — shared/donations.ts ($1,000 preset outcome, follow-up)
- **Before:** "Founding gift toward opening the doors in Dutchtown"
- **After:** "Founding member gift toward opening the doors in Dutchtown"
- **Principle:** ties the gift explicitly to membership, consistent with
  how the other presets describe a member benefit.

### 2026-09-13 — shared/donations.ts ($25 preset outcome)
- **Before:** "A full year of membership for an unemployed household"
- **After:** "Covers a full year of membership for an unemployed household"
- **Principle:** lead with the verb ("Covers...") — consistent with the
  $100 preset's "Provides...".

### 2026-09-13 — shared/donations.ts ($50 preset outcome)
- **Before:** "A year of at-cost groceries for a family earning under $30k"
- **After:** "Helps serve free, nourishing meals on Free Soup Fridays"
- **Content note, not a voice principle:** this is a different program than
  the previous text described (at-cost groceries → a free-meal program).
  The preset's `detail` line (shown right under this on the Donate page)
  still describes the old membership-tier story — the user is sending
  replacement text for it; update it before considering this preset done.

### 2026-09-13 — shared/donations.ts ($100 preset outcome, follow-up)
- **Before:** "Provides four $25 Give-a-Bag/Take-a-Bag gift cards to
  neighbors in need"
- **After:** "Gives four $25 Give-a-Bag/Take-a-Bag gift cards to neighbors
  facing tight grocery budgets"
- **Principle:** "facing tight grocery budgets" over "in need" — more
  specific and less charity-cliché.

### 2026-09-13 — shared/donations.ts ($100 preset outcome, second follow-up)
- **Before:** "Gives four $25 Give-a-Bag/Take-a-Bag gift cards to neighbors
  facing tight grocery budgets"
- **After:** "Gives four $25 gift cards to neighbors facing tight grocery
  budgets" (no trailing period — dropped from the user's draft to keep the
  no-period rule for this list).
- **Principle:** drop the program name from the outcome line when the
  `detail` line right below it doesn't need it either — shorter reads
  better here.

### 2026-09-13 — src/app/components/Board.tsx (projector header kicker)
- **Before:** "Tuesday, September 22, 2026 · Contemporary Art Museum St.
  Louis"
- **After:** "Tuesday, September 22, 2026"
- **Principle:** same trim as the earlier home-page hero kicker — lead
  with the date only, venue is secondary. (Verification note: the browser
  tab served a stale `index.html` from plain HTTP cache after the SW was
  unregistered — a cache-busted query string forced a fresh fetch to
  confirm. Not a site bug, just a local dev-server verification quirk.)

### 2026-09-13 — src/app/components/Board.tsx (projector heading layout)
Changed the projector's "Growing City Greens" from one line to three
stacked lines (Growing / City / Greens), matching the home page's hero
treatment.

### 2026-09-13 — src/app/components/Board.tsx (projector subhead)
- **Before:** "Help open a grocery store in Dutchtown."
- **After:** "Help expand food access for all!"
- **Content note, not a voice principle:** this is a different framing
  than the store-opening story elsewhere on the projector board (QR/donate
  copy still says "Help open a grocery store in Dutchtown" via
  `Section` fallback text and Home's headline) — the user's call, noted
  for consistency awareness rather than flagged as an inconsistency to fix.

### 2026-09-13 — src/app/components/Board.tsx (QR code size)
Enlarged the QR code container from `w-[clamp(180px,20vw,340px)]` to
`w-[clamp(220px,26vw,440px)]` and bumped the generated raster from 600px
to 800px so it stays crisp at the larger display size.

### 2026-09-13 — src/app/components/Home.tsx (gift-presets heading)
- **Before:** "What your gift does"
- **After:** "Your gift's impact"
- **Principle:** a wording preference, not a broader rule — noted for the
  record.

