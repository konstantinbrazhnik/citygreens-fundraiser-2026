// Rasterizes timone/public/icons/mark.svg into the PNGs the Home Screen wants.
// Chromium (the one Playwright already ships with) is the renderer, so there is
// no new image dependency to install.
//
//   node scripts/timone-icons.mjs
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const icons = join(root, 'timone', 'public', 'icons');
const svg = await readFile(join(icons, 'mark.svg'), 'utf8');

const sizes = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-48.png', size: 48 },
];

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
});

for (const { file, size } of sizes) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0;background:transparent}
     svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  const png = await page.screenshot({ omitBackground: true });
  await writeFile(join(icons, file), png);
  await page.close();
  console.log(`${file}  ${size}×${size}`);
}

await browser.close();
