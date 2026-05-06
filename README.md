# MealDeal Extension

Chrome Manifest V3 extension + thin Next.js API bridge that compares the real
visible cost of the same cart across Uber Eats, DoorDash, and Grubhub.

The extension auto-detects the cart on the active delivery tab, posts it to the
backend, which then drives the MealDeal Apify Actor (separate repo, owned by
Person B) and returns a normalized `MealDealResult`.

## Layout

```
mealdeal-extension/   Chrome MV3 extension (React + Vite, content scripts, SW)
mealdeal-api/         Next.js backend that holds APIFY_TOKEN server-side
```

Shared types in both folders mirror the Actor's `src/types.ts` verbatim so the
request / quote / result contract stays in sync.

## Dev

### Backend

```bash
cd mealdeal-api
cp .env.example .env.local   # fill in APIFY_TOKEN and APIFY_ACTOR_ID
npm install
npm run dev                  # http://localhost:3000
```

### Extension

```bash
cd mealdeal-extension
npm install
npm run build                # produces dist/
# then chrome://extensions -> "Load unpacked" -> point at dist/
```

`VITE_MEALDEAL_API_URL` (optional) lets you point the extension at a non-local
backend.

## Tests

```bash
cd mealdeal-api        && npm test   # 9 tests (request validation)
cd mealdeal-extension  && npm test   # 29 tests (storage, parsing, UI helpers)
```

## Safety

- `APIFY_TOKEN` lives only in `mealdeal-api` env; the extension never sees it.
- No delivery-platform credentials are stored.
- The Actor never places orders or processes payment.
