# mealdeal-api

Thin Next.js backend that bridges the MealDeal Chrome extension and the custom
Apify Actor. Holds `APIFY_TOKEN` server-side only.

## Routes

- `POST /api/run-mealdeal` — starts the Actor and either waits up to
  `MEALDEAL_MAX_WAIT_MS` for the final `MealDealResult` or returns a `runId`.
- `GET /api/actor-status?runId=<id>` — polls the Actor run and returns the
  `MealDealResult` once it's ready.

## Env

Copy `.env.example` to `.env.local` and fill in:

- `APIFY_TOKEN` — Apify API token (server-only, never exposed to clients).
- `APIFY_ACTOR_ID` — e.g. `your-username~mealdeal-quote-scraper`.
- `MEALDEAL_MAX_WAIT_MS` — optional inline wait window (default: 60000).
- `MEALDEAL_EXTENSION_ORIGIN` — optional CORS origin for the extension.

## Dev

```bash
npm install
npm run dev
```
