/**
 * Download a real Save PNG export and keep it, so a human can look at it.
 *
 * Learning 15: html2canvas is not the browser, and only a picture catches the
 * difference. Unit tests and the injection harness both pass while the raster
 * is visibly wrong, so any change to a chat renderer or to the export clone
 * needs an actual exported image opened and inspected at zoom.
 *
 * Usage:
 *   node scripts/capture-export-png.mjs [baseUrl] [outFile] [exampleId]
 */
import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] || 'http://127.0.0.1:3300';
const outFile = process.argv[3] || path.join(here, '..', 'tmp', 'export-check.png');
const exampleId = process.argv[4] || 'ios-rich-group-scene';

const browser = await chromium.launch({ channel: process.env.UX_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: new RegExp(exampleId, 'i') }).first().click();
const deny = page.getByRole('button', { name: /don.?t allow/i });
if (await deny.count()) await deny.first().click().catch(() => {});
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2500);

const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
await page.getByRole('button', { name: /save png/i }).click();
const download = await downloadPromise;
await download.saveAs(outFile);

console.log(`export written: ${outFile}`);
await browser.close();
