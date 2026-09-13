// Secrets set with `wrangler secret put`. `wrangler types` only knows about
// vars, so these are declared by hand; every one is optional at runtime and
// the Worker degrades honestly when it is missing.
interface Env {
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_APPLICATION_ID?: string;
  SQUARE_LOCATION_ID?: string;
  ADMIN_KEY?: string;
}
