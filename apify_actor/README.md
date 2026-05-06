# MealDeal Actor

Custom Apify Actor for the Person B MealDeal workstream. It opens food-delivery platforms with Crawlee and Playwright, tries to build the requested cart, extracts visible item subtotals, and returns one normalized `MealDealResult`.

## Validate The Scraper

Run the normal code checks:

```powershell
npm run typecheck
npm test
npm run build
docker build -t mealdeal-actor .
```

Run the deterministic scraper test:

```powershell
npm run test:scraper
```

`test:scraper` points the real Actor platform flows at fixture pages in `fixtures/`. This proves the scraper can extract restaurant names, matching menu items, subtotal, delivery fee, service fee, small order fee, tax, discount, promo text, ETA, choose the cheapest platform by item subtotal, and return normalized quotes.

## Live-Site Smoke Test

Live delivery sites may block headless browsers, require login, show CAPTCHA, or hide checkout totals. Those are expected live-site outcomes; the Actor compares visible item subtotals instead of trying to checkout or inventing prices.

For normal Docker testing, keep `debug=false` to avoid large screenshot writes on Windows bind mounts.

## Apify Deployment

This Actor is configured as `mealdeal-scraper` in `.actor/actor.json`.

In **Windows PowerShell**, from this Actor folder:

```powershell
cd "C:\Users\Mr. Paul\Downloads\MealDeal Actor"
apify validate-schema
apify push
```

The Actor input supports Apify Proxy through `proxyConfiguration`. Leave `useApifyProxy` disabled for the first smoke test, then enable it in Apify Console if a platform blocks cloud traffic.

DoorDash and Uber Eats may still require a real user-visible browser session for some cart data. The supported production path is for the extension/backend to pass `userVisibleSnapshots` captured from the user's already logged-in tab. When a snapshot is supplied for a selected platform, the Actor compares that quote and skips live scraping for that platform.

## DoorDash Store Actors

DoorDash has strong browser security. MealDeal now uses external Apify Store actors for DoorDash menu prices when possible, then normalizes the result into the same `PlatformQuote` shape.

The tested working direct-store path is:

```text
crawlerbros/doordash-restaurant-scraper
```

Other actors are kept as fallbacks when the direct actor does not return usable menu data. `memo23/doordash-reviews-cheerio` currently requires renting the paid Store actor in Apify Console before this account can run it; the CLI cannot auto-rent it for you.

For best DoorDash results, provide a DoorDash store URL:

```json
{
  "address": "2550 Van Ness Avenue, San Francisco, CA",
  "restaurantName": "Halal City",
  "query": "Rice Platters",
  "cartItems": [{ "name": "Rice Platters", "quantity": 2 }],
  "platforms": ["doordash"],
  "doorDashStoreUrls": [
    "https://www.doordash.com/store/halal-city---soma-san-francisco-34620533"
  ],
  "doorDashUseExternalActors": true,
  "maxCandidatesPerPlatform": 3,
  "debug": false
}
```

This returns a DoorDash `quoteLevel` of `menu`: it is a menu-derived item subtotal, not checkout fees, tax, or final total.

## DoorDash Verification

Do not try to bypass DoorDash human verification. The supported local path is to use your own browser session after you manually complete verification or sign in.

In **Windows PowerShell**, from this Actor folder:

```powershell
cd "C:\Users\Mr. Paul\Downloads\MealDeal Actor"
npm run session:doordash
```

Chrome opens. In **Chrome**, complete DoorDash verification and sign in if needed. When DoorDash is usable, go back to **PowerShell** and press Enter. This saves cookies in `profiles\doordash`, which is ignored by Git.

Then run a local DoorDash smoke test in **PowerShell**:

```powershell
cd "C:\Users\Mr. Paul\Downloads\MealDeal Actor"

$storage = "storage-doordash-profile"
Remove-Item -Recurse -Force $storage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$storage\key_value_stores\default" | Out-Null

@{
  address="525 Market St, San Francisco, CA"
  restaurantName="McDonald's"
  query="Big Mac"
  cartItems=@(@{ name="Big Mac"; quantity=1 })
  platforms=@("doordash")
  maxCandidatesPerPlatform=3
  debug=$true
  platformBrowserUserDataDirs=@{ doordash=(Resolve-Path "profiles\doordash").Path }
} | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 "$storage\key_value_stores\default\INPUT.json"

$env:APIFY_LOCAL_STORAGE_DIR = (Resolve-Path $storage).Path
$env:CRAWLEE_STORAGE_DIR = (Resolve-Path $storage).Path
npm run dev
Remove-Item Env:\APIFY_LOCAL_STORAGE_DIR -ErrorAction SilentlyContinue
Remove-Item Env:\CRAWLEE_STORAGE_DIR -ErrorAction SilentlyContinue

Get-Content "$storage\datasets\default\000000001.json"
```

Use `npm run dev` for this profile test. Docker runs Linux Chrome under Xvfb, so it cannot use an interactive Windows Chrome session reliably.
