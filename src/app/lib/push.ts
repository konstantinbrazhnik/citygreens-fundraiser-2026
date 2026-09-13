import type { PushSubscriptionJSON } from '@shared/push';

/**
 * The organizer's phone side of push notifications. The rules that matter:
 * Chrome/Edge/Firefox subscribe from a normal tab; Safari on iPhone and iPad
 * only offers PushManager once the site is on the Home Screen (iOS 16.4+),
 * and a Home Screen app has its own storage, which is why the invite link
 * carries the key.
 */
export type PushSupport = 'ready' | 'needs-home-screen' | 'unsupported';

export function isApple(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function pushSupport(): PushSupport {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ready';
  if (isApple() && !isStandalone()) return 'needs-home-screen';
  return 'unsupported';
}

export function permissionState(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

/** A short, human label for the device list: "iPhone · Safari". */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${device} · ${browser}${isStandalone() ? ' · Home Screen' : ''}`;
}

const READY_MS = 8000;

async function registration(): Promise<ServiceWorkerRegistration> {
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('The app is still installing. Reload and try again.')), READY_MS));
  return Promise.race([ready, timeout]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ready') return null;
  try {
    const reg = await registration();
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function serverKey(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Asks for permission, subscribes, and hands back what the server stores. */
export async function subscribePush(publicKey: string): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.' : 'Notifications were not allowed.');
  }
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey(publicKey) });
    } catch (err) {
      // Chromium builds without a push service (and some privacy browsers) abort here.
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'NotSupportedError')) {
        throw new Error('This browser could not reach its push service. Try Chrome, or Safari from the Home Screen on iPhone.');
      }
      throw err;
    }
  }
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('This browser gave an incomplete subscription.');
  return { endpoint: json.endpoint, expirationTime: json.expirationTime ?? null, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

/** Returns the endpoint that was dropped, so the server can forget it too. */
export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
