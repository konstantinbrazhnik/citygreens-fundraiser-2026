-- Every gift, however it arrived. `id` is minted by the client (a UUID) and is
-- also the Square idempotency key, so a phone that retries a flaky request can
-- never charge or record twice.
CREATE TABLE donations (
  id TEXT PRIMARY KEY,
  amount_cents INTEGER NOT NULL,
  donor_name TEXT,
  anonymous INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  email TEXT,
  source TEXT NOT NULL,              -- 'square' | 'simulated' | 'manual'
  square_payment_id TEXT,
  receipt_url TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  status TEXT NOT NULL DEFAULT 'completed',  -- 'completed' | 'hidden'
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX donations_created_at ON donations (created_at);
CREATE INDEX donations_status ON donations (status);

-- Newsletter sign-ups. Forwarded to Mailchimp on the spot; kept here too so a
-- Mailchimp hiccup during the event never loses an address (`synced` = 0).
CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  synced INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Runtime knobs the organizers turn from #/admin: goal_cents, offset_cents
-- (money raised elsewhere — tickets, sponsors — that should count on the
-- board), offset_label.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
