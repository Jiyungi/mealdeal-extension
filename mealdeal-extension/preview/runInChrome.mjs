// Launches a real Chromium with the MealDeal MV3 extension loaded unpacked
// (same thing `chrome://extensions -> Load unpacked` does), opens the popup,
// drives the form, and screenshots each state.
//
// Prereq: build the extension first:
//   npm run build
//
// The popup will try to POST to VITE_MEALDEAL_API_URL on submit, so either
// run mealdeal-api locally or expect the error state in 03-running.png.
//
// Then run:
//   node preview/runInChrome.mjs

import { chromium } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const EXT_DIR = resolve(__dirname, "../dist");
const PROFILE_DIR = resolve(__dirname, "../.chrome-profile");
const OUT_DIR = resolve(__dirname, "../chrome-screenshots");

await rm(PROFILE_DIR, { recursive: true, force: true });
await mkdir(PROFILE_DIR, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  channel: "chromium",
  viewport: { width: 480, height: 720 },
  args: [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
  ],
});

// Wait for the MV3 service worker so we can discover the extension ID.
let [sw] = ctx.serviceWorkers();
if (!sw) {
  sw = await ctx.waitForEvent("serviceworker", { timeout: 15_000 });
}
const extId = new URL(sw.url()).host;
console.log("Extension service worker:", sw.url());
console.log("Extension ID:", extId);

const popupUrl = `chrome-extension://${extId}/src/popup/index.html`;
const page = await ctx.newPage();
await page.goto(popupUrl, { waitUntil: "domcontentloaded" });

// The popup's detection branch runs chrome.tabs.query. On a blank/extension
// tab it falls through to "unsupported" and renders the manual SearchForm.
await page.waitForSelector(".search-form", { timeout: 15_000 });
await page.screenshot({ path: join(OUT_DIR, "01-form.png") });
console.log("Captured 01-form.png");

// Fill the form. Labels in SearchForm.tsx:
//   "Delivery address", "Restaurant name (optional)", "Food query"
await page.getByLabel("Delivery address").fill(
  "525 Market St, San Francisco, CA",
);
await page.getByLabel("Restaurant name (optional)").fill("Thai Time");
await page.getByLabel("Food query").fill("Chicken Pad Thai");

// Cart items: fill the first row's name input (inside the <fieldset> with
// legend "Cart items"). Use a scoped locator to avoid colliding with the
// Food query input that shares its placeholder.
const cartFieldset = page.locator(".cart-items");
await cartFieldset.locator("input[type=text]").first().fill("Chicken Pad Thai");
await cartFieldset.locator("input[type=number]").first().fill("2");

await page.screenshot({ path: join(OUT_DIR, "02-filled.png") });
console.log("Captured 02-filled.png");

// Submit and try to catch the running state (mock delay is ~900ms).
await page.getByRole("button", { name: /Find the cheapest/i }).click();

try {
  await page.waitForSelector(".loading-state", { timeout: 2_000 });
  await page.screenshot({ path: join(OUT_DIR, "03-running.png") });
  console.log("Captured 03-running.png");
} catch {
  console.log("Skipped running screenshot (finished before we could catch it).");
}

// Final result
await page.waitForSelector(".result-card", { timeout: 15_000 });
await page.screenshot({
  path: join(OUT_DIR, "04-result.png"),
  fullPage: true,
});
console.log("Captured 04-result.png");

await ctx.close();
console.log(`\nDone. Screenshots in ${OUT_DIR}`);
