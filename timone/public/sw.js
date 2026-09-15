/* Timone's guide, offline.
   Everything is precached on install and served cache-first, so the guide
   opens in a basement, in a park, or with the phone in airplane mode. When
   there is signal, each visit quietly refreshes the copy in the cache. */

var VERSION = 'timone-v1';

var CORE = [
  './',
  'app.css',
  'app.js',
  'manifest.webmanifest',
  'fonts/outfit-latin.woff2',
  'fonts/limelight-latin.woff2',
  'icons/mark.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-48.png',
  // photo.jpg is optional, so it is cached on first sight instead of here.
];

/* Cloudflare hands these files over gzipped, and by the time a fetch resolves
   the body has already been unzipped — but `content-encoding: gzip` is still
   on the response. Storing that header would have the browser try to unzip
   plain text on the way back out of the cache, which fails the request. So
   everything is rebuilt with just the header that matters. */
function storable(response) {
  return response.blob().then(function (body) {
    var headers = new Headers();
    var type = response.headers.get('content-type');
    if (type) headers.set('content-type', type);
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  });
}

function save(cache, request, response) {
  return storable(response).then(function (copy) {
    return cache.put(request, copy);
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      // One at a time: a single missing file should not fail the install.
      return Promise.all(
        CORE.map(function (path) {
          return refresh(cache, new Request(path, { cache: 'reload' }), path === './');
        }),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (names) {
        return Promise.all(
          names.map(function (name) {
            return name === VERSION ? null : caches.delete(name);
          }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

// Pulls a fresh copy into the cache and hands it back. Never throws: no signal
// is the normal case here.
// `isPage` guards the one trap in a single-page site: a file that isn't there
// comes back as the guide's own HTML, and caching that under, say, photo.jpg
// would keep a real photo from ever showing up. Pass it through, don't store it.
function refresh(cache, request, isPage) {
  return fetch(request)
    .then(function (response) {
      if (!response || !response.ok) return response || null;
      var type = response.headers.get('content-type') || '';
      if (!isPage && type.indexOf('text/html') === 0) return response;
      return save(cache, request, response.clone()).then(function () {
        return response;
      });
    })
    .catch(function () {
      return null;
    });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Any navigation lands on the one page this app has.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(VERSION).then(function (cache) {
        var page = new Request('./');
        return cache.match(page).then(function (cached) {
          if (cached) {
            event.waitUntil(refresh(cache, page, true)); // freshen for the next open
            return cached;
          }
          return refresh(cache, page, true).then(function (response) {
            return response || new Response('Offline', { status: 503 });
          });
        });
      }),
    );
    return;
  }

  event.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(request).then(function (cached) {
        if (cached) {
          event.waitUntil(refresh(cache, request, false));
          return cached;
        }
        return refresh(cache, request, false).then(function (response) {
          return response || new Response('', { status: 504 });
        });
      });
    }),
  );
});
