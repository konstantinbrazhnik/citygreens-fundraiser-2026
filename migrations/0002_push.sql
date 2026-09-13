-- Organizer phones that asked for a push notification on every gift. One row
-- per browser subscription; the push service's endpoint is the identity.
-- Rows are dropped when the push service says the subscription is gone
-- (404/410) or the organizer turns notifications off.
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  label TEXT,                       -- browser / device, for the admin list
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_sent_at TEXT,
  last_error TEXT
);
