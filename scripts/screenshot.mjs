import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('assets/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function shot(page, name) {
  await wait(800);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  captured ${name}.png`);
  return file;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();

const frames = [];

// ── Dashboard ──────────────────────────────────────────────────────────────
console.log('→ Dashboard');
await page.goto(BASE, { waitUntil: 'load' });
await wait(2000);
frames.push(await shot(page, '01-dashboard'));

// ── Open first project ─────────────────────────────────────────────────────
console.log('→ Project detail');
const card = page.locator('[data-testid="project-card"], .project-card, article').first();
const cardExists = await card.count() > 0;
if (cardExists) {
  await card.click();
  await wait(1000);
  frames.push(await shot(page, '02-project-detail'));
} else {
  // Click whatever opens a project — try clicking first link or clickable row
  const clickable = page.locator('a, [role="button"], button').filter({ hasText: /./}).first();
  if (await clickable.count() > 0) {
    await clickable.click();
    await wait(1000);
    frames.push(await shot(page, '02-project-detail'));
  }
}

// ── Grid / list toggle ─────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: 'load' });
await wait(1200);
// Try to switch to list view
const listToggle = page.locator('button[aria-label*="list" i], button[title*="list" i], [data-view="list"]');
if (await listToggle.count() > 0) {
  await listToggle.first().click();
  await wait(600);
  frames.push(await shot(page, '03-list-view'));
}

// ── Read-only /view ────────────────────────────────────────────────────────
console.log('→ /view');
await page.goto(`${BASE}/view`, { waitUntil: 'load' });
await wait(2000);
frames.push(await shot(page, '04-view-dashboard'));

// ── Read-only project detail ───────────────────────────────────────────────
console.log('→ /view project detail');
const viewCard = page.locator('article, [role="button"], a').first();
if (await viewCard.count() > 0) {
  await viewCard.click();
  await wait(1000);
  frames.push(await shot(page, '05-view-detail'));
}

await browser.close();

// ── Build GIF with ffmpeg ──────────────────────────────────────────────────
console.log('\n→ Building GIF…');

// Write concat file with explicit duration per frame (2s each)
const concatLines = frames.flatMap(f => [`file '${f}'`, `duration 2`]);
// Repeat last frame without duration (ffmpeg concat quirk)
concatLines.push(`file '${frames[frames.length - 1]}'`);
const concatFile = path.join(OUT, 'frames.txt');
fs.writeFileSync(concatFile, concatLines.join('\n') + '\n');

const palette = path.join(OUT, 'palette.png');

execSync(
  `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -vf "scale=1200:-1:flags=lanczos,palettegen=max_colors=128" "${palette}"`,
  { stdio: 'inherit' }
);

const gifOut = path.resolve('assets/demo.gif');
execSync(
  `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -i "${palette}" -filter_complex "scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer" "${gifOut}"`,
  { stdio: 'inherit' }
);

console.log(`\n✓ GIF saved to ${gifOut}`);
fs.rmSync(OUT, { recursive: true });
