import { Actor, log } from "apify";
import { PlaywrightCrawler, RequestList } from "crawlee";
import type { Page } from "playwright";
import type { ActorInput, PlatformQuote } from "../types.js";
import { detectPageState, pageStateWarnings } from "../extractors/detectPageState.js";
import { selectBestRestaurantMatch } from "../steps/selectBestRestaurantMatch.js";
import { screenshotDebug } from "../utils/screenshotDebug.js";
import {
  resolvePlatformProxyConfiguration,
  resolvePlatformUserDataDir
} from "../utils/platformRuntime.js";
import {
  makeFailedQuote,
  type MenuItemCandidate,
  type PlatformAdapter,
  type RestaurantCandidate
} from "../platforms/basePlatform.js";

export async function runPlatformQuoteFlow(
  adapter: PlatformAdapter,
  input: ActorInput
): Promise<PlatformQuote> {
  let quote: PlatformQuote | null = null;
  let restaurant: RestaurantCandidate | null = null;
  let menuItem: MenuItemCandidate | null = null;
  const flowWarnings: string[] = [];
  const startUrl = input.platformStartUrls?.[adapter.platform] ?? adapter.homepageUrl;
  const proxyConfiguration = await resolvePlatformProxyConfiguration(input, adapter.platform);
  const userDataDir = resolvePlatformUserDataDir(input, adapter.platform);

  const requestList = await RequestList.open(`${adapter.platform}-${Date.now()}`, [
    {
      url: startUrl,
      uniqueKey: `${adapter.platform}-${Date.now()}`
    }
  ]);

  const crawler = new PlaywrightCrawler({
    requestList,
    maxRequestsPerCrawl: 1,
    maxRequestRetries: 0,
    requestHandlerTimeoutSecs: 180,
    sessionPoolOptions: adapter.crawlerBlockedStatusCodes
      ? { blockedStatusCodes: adapter.crawlerBlockedStatusCodes }
      : undefined,
    proxyConfiguration,
    preNavigationHooks: [
      async ({ page }) => {
        await page.setExtraHTTPHeaders({
          "accept-language": "en-US,en;q=0.9"
        });
      }
    ],
    launchContext: {
      userDataDir,
      useChrome: true,
      launchOptions: {
        headless: true,
        args: ["--disable-blink-features=AutomationControlled"]
      }
    },
    async requestHandler({ page }) {
      page.setDefaultTimeout(12000);
      page.setDefaultNavigationTimeout(30000);

      try {
        await screenshotDebug(page, input, adapter.platform, "start");
        const startText = await getPageText(page);
        const startState = detectPageState(startText, page.url());
        if (startState.blocked || startState.loginRequired) {
          quote = await adapter.extractQuote(page, input, {
            restaurant: null,
            menuItem: null,
            flowWarnings: pageStateWarnings(adapter.label, startState)
          });
          return;
        }

        const candidates = await adapter.searchRestaurants(page, input);
        await screenshotDebug(page, input, adapter.platform, "restaurant-search");
        const searchText = await getPageText(page);
        const searchState = detectPageState(searchText, page.url());
        restaurant = selectBestRestaurantMatch(input, candidates);
        if (!restaurant) {
          const warnings = [
            ...pageStateWarnings(adapter.label, searchState),
            `${adapter.label} returned no usable restaurant candidates.`
          ];
          quote =
            searchState.blocked || searchState.loginRequired || searchState.closedOrPreorder
              ? await adapter.extractQuote(page, input, {
                  restaurant: null,
                  menuItem: null,
                  flowWarnings: warnings
                })
              : makeFailedQuote(adapter.platform, input, warnings);
          return;
        }

        flowWarnings.push(...(await adapter.openRestaurant(page, restaurant, input)));
        await screenshotDebug(page, input, adapter.platform, "restaurant-menu");
        const menuText = await getPageText(page);
        const menuState = detectPageState(menuText, page.url());
        flowWarnings.push(...pageStateWarnings(adapter.label, menuState));
        if (menuState.blocked || menuState.loginRequired || menuState.closedOrPreorder) {
          quote = await adapter.extractQuote(page, input, {
            restaurant,
            menuItem: null,
            flowWarnings
          });
          return;
        }

        menuItem = await adapter.findMenuItem(page, input);
        if (!menuItem) {
          quote = makeFailedQuote(adapter.platform, input, [
            `No visible menu item on ${adapter.label} matched "${input.cartItems[0].name}".`
          ], restaurant);
          return;
        }

        flowWarnings.push(...(await adapter.addItemToCart(page, menuItem, input)));
        await screenshotDebug(page, input, adapter.platform, "after-add-item");
        flowWarnings.push(...(await adapter.openQuotePage(page, input)));
        await screenshotDebug(page, input, adapter.platform, "quote-page");
        quote = await adapter.extractQuote(page, input, {
          restaurant,
          menuItem,
          flowWarnings
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown platform flow error.";
        quote = makeFailedQuote(
          adapter.platform,
          input,
          [`${adapter.label} flow failed: ${message}`],
          restaurant,
          menuItem
        );
      }
    },
    async failedRequestHandler(_context, error) {
      if (!quote) {
        const message = error instanceof Error ? error.message : "Request failed before the page handler ran.";
        quote = makeFailedQuote(
          adapter.platform,
          input,
          [`${adapter.label} request failed before quote extraction: ${message}`],
          restaurant,
          menuItem
        );
      }
    }
  });

  log.info(`Running ${adapter.label} quote flow.`);
  await crawler.run();

  return (
    quote ??
    makeFailedQuote(adapter.platform, input, [
      `${adapter.label} did not produce a quote before the crawler finished.`
    ], restaurant, menuItem)
  );
}

async function getPageText(page: Page): Promise<string> {
  return page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
}
