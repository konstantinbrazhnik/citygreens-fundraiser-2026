#!/usr/bin/env bash
# One-time Cloudflare setup for the Growing City Greens app.
# Needs `npx wrangler login` (or CLOUDFLARE_API_TOKEN) for the City Greens account.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_NAME="city-greens-fundraiser"

echo "▶ Checking Cloudflare login"
npx wrangler whoami

if grep -q '00000000-0000-0000-0000-000000000000' wrangler.jsonc; then
  echo "▶ Creating D1 database $DB_NAME"
  out="$(npx wrangler d1 create "$DB_NAME" 2>&1 | tee /dev/stderr)"
  id="$(printf '%s' "$out" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  if [ -z "$id" ]; then
    echo "Could not read the database id from wrangler's output; paste it into wrangler.jsonc by hand." >&2
    exit 1
  fi
  sed -i.bak "s/00000000-0000-0000-0000-000000000000/$id/" wrangler.jsonc && rm -f wrangler.jsonc.bak
  echo "   database_id = $id written to wrangler.jsonc"
else
  echo "▶ D1 database id already set in wrangler.jsonc"
fi

echo "▶ Secrets (press Enter to skip one you have already set)"
for name in SQUARE_ACCESS_TOKEN SQUARE_APPLICATION_ID SQUARE_LOCATION_ID ADMIN_KEY; do
  read -r -s -p "   $name: " value; echo
  if [ -n "$value" ]; then printf '%s' "$value" | npx wrangler secret put "$name"; fi
done

echo "▶ Test, build, migrate, deploy"
npm run deploy

echo
echo "Done. Next: attach a custom domain to the Worker in the Cloudflare dashboard"
echo "and, for Apple Pay, register that domain under the Square application."
