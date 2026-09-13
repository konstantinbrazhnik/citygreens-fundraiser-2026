import { buildPushPayload, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push';
import type { PushNotice } from '../../shared/push';

/**
 * Web Push to the organizers' phones. VAPID keys are the only configuration:
 * the public half is a var in wrangler.jsonc (the browser needs it to
 * subscribe), the private half a secret. Without them everything here is a
 * no-op and #/admin says so.
 */
export function pushConfigured(env: Env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

function vapid(env: Env): VapidKeys {
  return {
    subject: env.VAPID_SUBJECT || 'https://www.stlcitygreens.org',
    publicKey: env.VAPID_PUBLIC_KEY!,
    privateKey: env.VAPID_PRIVATE_KEY!,
  };
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushReport {
  sent: number;
  failed: number;
  /** Subscriptions the push service said are gone; already deleted. */
  dropped: number;
}

/** Fan a notice out to every subscribed organizer. Never throws: a gift is recorded whether or not the phones hear about it. */
export async function notifyOrganizers(env: Env, notice: PushNotice): Promise<PushReport> {
  const report: PushReport = { sent: 0, failed: 0, dropped: 0 };
  if (!pushConfigured(env)) return report;
  const { results } = await env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions').all<SubRow>();
  if (results.length === 0) return report;
  const keys = vapid(env);
  const now = new Date().toISOString();
  await Promise.all(
    results.map(async (row) => {
      const sub: PushSubscription = { endpoint: row.endpoint, expirationTime: null, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        const payload = await buildPushPayload({ data: notice, options: { ttl: 3600, urgency: 'high' } }, sub, keys);
        const res = await fetch(sub.endpoint, payload);
        if (res.ok) {
          report.sent++;
          await env.DB.prepare('UPDATE push_subscriptions SET last_sent_at = ?, last_error = NULL WHERE id = ?').bind(now, row.id).run();
        } else if (res.status === 404 || res.status === 410) {
          report.dropped++;
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(row.id).run();
        } else {
          report.failed++;
          const text = (await res.text().catch(() => '')).slice(0, 200);
          await env.DB.prepare('UPDATE push_subscriptions SET last_error = ? WHERE id = ?').bind(`${res.status} ${text}`.trim(), row.id).run();
        }
      } catch (err) {
        report.failed++;
        console.error('push failed', row.endpoint, err);
        await env.DB.prepare('UPDATE push_subscriptions SET last_error = ? WHERE id = ?')
          .bind(String(err instanceof Error ? err.message : err).slice(0, 200), row.id)
          .run()
          .catch(() => {});
      }
    }),
  );
  return report;
}
