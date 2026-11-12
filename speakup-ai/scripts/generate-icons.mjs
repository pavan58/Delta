// Renders the SpeakUp AI logo SVG to PNG icons using the pre-installed Playwright Chromium.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b63f6"/><stop offset="1" stop-color="#1f338f"/></linearGradient></defs>
<rect width="64" height="64" rx="${pad ? 0 : 16}" fill="url(#g)"/>
<g transform="${pad ? "translate(6.4 6.4) scale(0.8)" : ""}">
<path d="M18 22a8 8 0 0 1 8-8h14a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8h-9l-8 7v-7.4A8 8 0 0 1 18 34z" fill="#fff"/>
<rect x="27" y="20" width="4" height="16" rx="2" fill="#2747e0"/><rect x="33" y="24" width="4" height="8" rx="2" fill="#ff9a1f"/>
<rect x="21" y="25" width="4" height="6" rx="2" fill="#2747e0"/><rect x="39" y="26" width="4" height="4" rx="2" fill="#2747e0"/></g></svg>`;

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon.svg", svg(false));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, maskable] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["maskable-512.png", 512, true], ["apple-touch-icon.png", 180, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(maskable).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: true });
}
await browser.close();
console.log("icons written to public/icons");
