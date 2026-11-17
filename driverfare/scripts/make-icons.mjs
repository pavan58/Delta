// Renders public/icon.svg to PNG icons using the preinstalled Chromium (dev-time only).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // run with NODE_PATH=$(npm root -g) if installed globally
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/icon.svg', 'utf8');
const b = await chromium.launch();
for (const [size, name] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `public/${name}`, omitBackground: true });
}
await b.close();
