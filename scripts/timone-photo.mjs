// Cuts timone/photo-source.jpg down to the two pictures the guide needs: the
// header photo and the Home Screen icon. Chromium (the one Playwright already
// ships with) does the cropping and resizing, so there is no image dependency
// to install.
//
//   node scripts/timone-photo.mjs
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'timone', 'public');

const SOURCE = { width: 1125, height: 1500 };
// Crops in source pixels. The face sits a little right of center, at ~(685, 520).
const HERO = { x: 0, y: 190, w: 1125, h: 844 }; // 4:3, the whole dog
const FACE = { x: 470, y: 305, w: 430, h: 430 }; // tight on his head
const FACE_WIDE = { x: 360, y: 200, w: 640, h: 640 }; // room for a mask to bite into

const jobs = [
  { file: 'photo.jpg', crop: HERO, w: 1125, h: 844, type: 'jpeg', quality: 82 },
  { file: 'icons/icon-512.png', crop: FACE, w: 512, h: 512 },
  { file: 'icons/icon-192.png', crop: FACE, w: 192, h: 192 },
  { file: 'icons/apple-touch-icon.png', crop: FACE, w: 180, h: 180 },
  { file: 'icons/favicon-48.png', crop: FACE, w: 48, h: 48 },
  { file: 'icons/icon-maskable-512.png', crop: FACE_WIDE, w: 512, h: 512 },
];

const data = await readFile(join(root, 'timone', 'photo-source.jpg'));
const src = 'data:image/jpeg;base64,' + data.toString('base64');

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_PATH || undefined,
});

for (const job of jobs) {
  const scale = job.w / job.crop.w;
  const page = await browser.newPage({
    viewport: { width: job.w, height: job.h },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<!doctype html><style>
       html,body{margin:0;padding:0;overflow:hidden;background:#000}
       img{position:absolute;
           width:${SOURCE.width * scale}px;
           height:${SOURCE.height * scale}px;
           left:${-job.crop.x * scale}px;
           top:${-job.crop.y * scale}px;
           image-rendering:auto}
     </style><img src="${src}">`,
  );
  await page.waitForFunction(() => {
    const img = document.querySelector('img');
    return img && img.complete && img.naturalWidth > 0;
  });
  const shot = await page.screenshot(
    job.type === 'jpeg' ? { type: 'jpeg', quality: job.quality } : { type: 'png' },
  );
  await writeFile(join(app, job.file), shot);
  await page.close();
  console.log(`${job.file}  ${job.w}×${job.h}  ${(shot.length / 1024).toFixed(0)}kB`);
}

await browser.close();
