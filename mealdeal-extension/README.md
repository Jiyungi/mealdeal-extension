# mealdeal-extension

Chrome Manifest V3 extension that lets a user enter a delivery address + meal
request, posts it to the MealDeal backend, and shows the cheapest platform
across Uber Eats, DoorDash, and Grubhub.

## Structure

- `src/popup` — React + Vite popup UI (form, loading, result card, table).
- `src/background/serviceWorker.ts` — MV3 service worker message router.
- `src/content/*` — per-platform content scripts that scrape the user's
  currently visible page and send snapshots to the service worker.
- `src/lib` — shared types (mirror of `mealdeal-actor/src/types.ts`),
  `apiClient`, `storage`, `formatMoney`, `platformLinks`.

## Env

Build-time variable (Vite):

- `VITE_MEALDEAL_API_URL` — base URL of `mealdeal-api`
  (defaults to `http://localhost:3000`).

`APIFY_TOKEN` is **never** referenced here.

## Dev

```bash
npm install
npm run dev          # Vite dev build with HMR
npm run build        # emits dist/ — load unpacked in chrome://extensions
```
