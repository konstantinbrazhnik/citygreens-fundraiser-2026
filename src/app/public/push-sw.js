/* global self, clients */
// Pulled into the generated service worker (vite.config.ts → workbox.importScripts).
// Turns an organizer push (shared/push.ts → PushNotice) into a system notification.

self.addEventListener('push', (event) => {
  let notice = null;
  try {
    notice = event.data ? event.data.json() : null;
  } catch {
    notice = null;
  }
  const title = (notice && notice.title) || 'New gift on the board';
  const options = {
    body: (notice && notice.body) || '',
    tag: (notice && notice.tag) || undefined,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: (notice && notice.url) || '/#/admin' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/#/admin', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          if ('navigate' in w) w.navigate(url).catch(() => {});
          return w.focus();
        }
      }
      return clients.openWindow(url);
    }),
  );
});
