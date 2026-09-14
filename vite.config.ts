import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const BUILD_ID =
  process.env.WORKERS_CI_COMMIT_SHA?.slice(0, 7) ??
  process.env.CF_VERSION_METADATA_ID?.slice(0, 7) ??
  `local-${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  root: 'src/app',
  publicDir: 'public',
  build: { outDir: '../../dist/client', emptyOutDir: true },
  resolve: { alias: { '@shared': path.resolve(import.meta.dirname, 'shared') } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/*.woff2', 'apple-logo.png', 'wordmark.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Growing City Greens',
        short_name: 'City Greens',
        description: "Give to open City Greens Market's new store in Dutchtown.",
        theme_color: '#285038',
        background_color: '#285038',
        display: 'standalone',
        id: '/',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Organizer push notifications: the handlers live in public/push-sw.js.
        importScripts: ['push-sw.js'],
        navigateFallback: 'index.html',
        // /admin comes from the Worker, which bakes the desk's manifest into the HTML.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\/?(\?|$)/],
        runtimeCaching: [
          {
            // The board totals: network first so a phone that opens the app
            // in a dead spot at the venue still shows the last thing it saw.
            urlPattern: ({ url }) => url.pathname === '/api/board',
            handler: 'NetworkFirst',
            options: { cacheName: 'board', networkTimeoutSeconds: 4, expiration: { maxEntries: 2 } },
          },
          {
            // Square's SDK must never be served stale.
            urlPattern: ({ url }) => url.hostname.endsWith('squarecdn.com'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
