// End-to-end verification of the cached-context + MutationObserver flow:
//   1. Load our extension into Chromium.
//   2. Serve a local "fake Uber Eats" page at https://www.ubereats.com/store/...
//      (via URL rerouting) so our content script's host match fires.
//   3. Let the page auto-add a second cart item after 1.5s.
//   4. Switch to a blank tab (so no active-tab delivery site).
//   5. Open the popup and confirm DetectedCart falls back to the cached
//      context (both items visible, "Last seen" badge).

import { chromium } from "playwright";
import { mkdir, rm, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const EXT_DIR = resolve(__dirname, "../dist");
const PROFILE_DIR = resolve(__dirname, "../.chrome-profile-live");
const OUT_DIR = resolve(__dirname, "../chrome-screenshots");
const FAKE_HTML = await readFile(
  resolve(__dirname, "./fakeUberEats.html"),
  "utf8",
);

await rm(PROFILE_DIR, { recursive: true, force: true });
await mkdir(PROFILE_DIR, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: true,
  channel: "chromium",
  viewport: { width: 1100, height: 800 },
  args: [
    `--disable-extensions-except=${EXT_DIR}`,
    `--load-extension=${EXT_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--ignore-certificate-errors",
  ],
});

// Serve the fake Uber Eats HTML for any request to ubereats.com so the
// manifest content_scripts "matches" rule fires.
await ctx.route("https://www.ubereats.com/**", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: FAKE_HTML,
  });
});

let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 15_000 });
const extId = new URL(sw.url()).host;
console.log("Extension ID:", extId);

// --- 1. Visit the fake Uber Eats page in a real tab ---
const restaurantPage = await ctx.newPage();
await restaurantPage.goto(
  "https://www.ubereats.com/store/halal-city/abc123",
  { waitUntil: "domcontentloaded" },
);
await restaurantPage.waitForSelector('[data-testid="cart-item"]');
await restaurantPage.screenshot({
  path: join(OUT_DIR, "live-01-restaurant-initial.png"),
});
console.log("Captured live-01-restaurant-initial.png");

// --- 2. Wait for the scripted cart mutation (second item added at t=1.5s) ---
await restaurantPage.waitForFunction(
  () => document.querySelectorAll('[data-testid="cart-item"]').length >= 2,
  { timeout: 5_000 },
);
// Give the MutationObserver debounce time to flush.
await restaurantPage.waitForTimeout(800);
await restaurantPage.screenshot({
  path: join(OUT_DIR, "live-02-restaurant-after-mutation.png"),
});
console.log("Captured live-02-restaurant-after-mutation.png");

// --- 3. Open the popup directly against the active (Uber Eats) tab ---
const popupLive = await ctx.newPage();
await popupLive.setViewportSize({ width: 480, height: 720 });
await popupLive.goto(
  `chrome-extension://${extId}/src/popup/index.html`,
  { waitUntil: "domcontentloaded" },
);
await popupLive.waitForSelector(".detected-cart, .search-form", {
  timeout: 10_000,
});
await popupLive.screenshot({ path: join(OUT_DIR, "live-03-popup-live.png") });
console.log("Captured live-03-popup-live.png");

await popupLive.close();

// --- 4. Switch the active tab to a blank non-delivery tab ---
const blankPage = await ctx.newPage();
await blankPage.goto("about:blank");
await blankPage.bringToFront();

// --- 5. Open popup again; should use cached context fallback ---
const popupCached = await ctx.newPage();
await popupCached.setViewportSize({ width: 480, height: 720 });
await popupCached.goto(
  `chrome-extension://${extId}/src/popup/index.html`,
  { waitUntil: "domcontentloaded" },
);
await popupCached.waitForSelector(".detected-cart, .search-form, .results", {
  timeout: 10_000,
});
await popupCached.waitForTimeout(400);
await popupCached.screenshot({
  path: join(OUT_DIR, "live-04-popup-cached.png"),
});
console.log("Captured live-04-popup-cached.png");

await ctx.close();
console.log(`\nDone. Screenshots in ${OUT_DIR}`);
