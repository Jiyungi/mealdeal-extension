import type { Page } from "playwright";
import type { ActorInput, PlatformQuote } from "../types.js";
import { addItemToCart as addItemToCartStep } from "../steps/addItemToCart.js";
import { extractQuoteBreakdown } from "../steps/extractQuoteBreakdown.js";
import { openCartOrCheckout } from "../steps/openCartOrCheckout.js";
import { openRestaurantMenu } from "../steps/openRestaurantMenu.js";
import { searchFoodOrRestaurant } from "../steps/searchFoodOrRestaurant.js";
import { selectBestItemMatch } from "../steps/selectBestItemMatch.js";
import { setDeliveryAddress } from "../steps/setDeliveryAddress.js";
import { extractMenuItems } from "../extractors/extractMenuItems.js";
import { extractRestaurantCandidates } from "../extractors/extractRestaurantCandidates.js";
import { resolvePlatformStartUrl } from "./basePlatform.js";
import type {
  MenuItemCandidate,
  PlatformAdapter,
  PlatformConfig,
  PlatformQuoteContext,
  RestaurantCandidate
} from "./basePlatform.js";

const config: PlatformConfig = {
  platform: "grubhub",
  label: "Grubhub",
  homepageUrl: "https://www.grubhub.com/",
  searchUrl: (term) => `https://www.grubhub.com/search?searchTerm=${encodeURIComponent(term)}`,
  addressInputSelectors: [
    'input[placeholder*="address" i]',
    'input[aria-label*="address" i]',
    'input[data-testid*="address" i]',
    'input[name*="address" i]'
  ],
  addressSuggestionSelectors: [
    '[data-testid*="address" i]',
    '[role="option"]',
    'button:has-text("Use this address")',
    'button:has-text("Deliver here")'
  ],
  addressSubmitSelectors: ['button:has-text("Use this address")', 'button:has-text("Done")'],
  searchInputSelectors: [
    'input[placeholder*="search" i]',
    'input[aria-label*="search" i]',
    'input[name*="search" i]'
  ],
  restaurantUrlPatterns: [/\/restaurant\//i, /\/delivery\//i],
  menuItemSelectorHints: [
    '[data-testid*="menu-item" i]',
    '[data-testid*="menuItem" i]',
    '[data-testid*="menuItemCard" i]',
    '[aria-label*="$"]',
    '[role="button"]',
    'button',
    'a'
  ],
  cartButtonTexts: [
    "View bag",
    "View cart",
    "View order",
    "Bag",
    "Cart",
    /view\s+(bag|cart|order)/i
  ],
  cartButtonSelectors: [
    'a[href*="/cart"]',
    'button[aria-label*="bag" i]',
    'button[aria-label*="cart" i]',
    'button[aria-label*="basket" i]',
    'a[aria-label*="bag" i]',
    'a[aria-label*="cart" i]',
    'button:has-text("View bag")',
    'button:has-text("View cart")'
  ],
  addToCartButtonTexts: [
    /add\s+\d+\s+to\s+(bag|cart|order)/i,
    /add\s+to\s+(bag|cart|order)/i,
    /add\s+item/i
  ],
  blockedTexts: [
    "captcha",
    "verify you are human",
    "verifying you are human",
    "sign in to continue",
    "access denied"
  ]
};

export class GrubhubAdapter implements PlatformAdapter {
  readonly platform = config.platform;
  readonly label = config.label;
  readonly homepageUrl = config.homepageUrl;

  async searchRestaurants(page: Page, input: ActorInput): Promise<RestaurantCandidate[]> {
    await page.goto(resolvePlatformStartUrl(input, config), { waitUntil: "domcontentloaded" });
    await setDeliveryAddress(page, config, input.address);
    await searchFoodOrRestaurant(page, config, input.restaurantName ?? input.query);
    return extractRestaurantCandidates(page, config, input.maxCandidatesPerPlatform);
  }

  async openRestaurant(
    page: Page,
    candidate: RestaurantCandidate,
    _input: ActorInput
  ): Promise<string[]> {
    return openRestaurantMenu(page, candidate);
  }

  async findMenuItem(page: Page, input: ActorInput): Promise<MenuItemCandidate | null> {
    const items = await extractMenuItems(page, config);
    return selectBestItemMatch(input, items);
  }

  async addItemToCart(
    page: Page,
    item: MenuItemCandidate,
    input: ActorInput
  ): Promise<string[]> {
    return addItemToCartStep(page, config, item, input.cartItems[0].quantity);
  }

  async openQuotePage(page: Page, _input: ActorInput): Promise<string[]> {
    return openCartOrCheckout(page, config);
  }

  async extractQuote(
    page: Page,
    input: ActorInput,
    context: PlatformQuoteContext
  ): Promise<PlatformQuote> {
    return extractQuoteBreakdown(page, config, input, context);
  }
}
