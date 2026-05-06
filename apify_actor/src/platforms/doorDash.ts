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
  platform: "doordash",
  label: "DoorDash",
  homepageUrl: "https://www.doordash.com/",
  searchUrl: (term) => `https://www.doordash.com/search/store/${encodeURIComponent(term)}/`,
  addressInputSelectors: [
    'input[placeholder*="address" i]',
    'input[aria-label*="address" i]',
    'input[data-testid*="address" i]',
    'input[name*="address" i]'
  ],
  addressSuggestionSelectors: [
    '[data-testid*="AddressAutocomplete" i]',
    '[role="option"]',
    'button:has-text("Save")'
  ],
  addressSubmitSelectors: ['button:has-text("Save")', 'button:has-text("Done")'],
  searchInputSelectors: [
    'input[placeholder*="search" i]',
    'input[aria-label*="search" i]',
    'input[data-testid*="search" i]'
  ],
  restaurantUrlPatterns: [/\/store\//i],
  menuItemSelectorHints: [
    '[data-testid*="MenuItem" i]',
    '[data-testid*="menu-item" i]',
    '[data-anchor-id*="MenuItem" i]',
    '[aria-label*="$"]',
    '[role="button"]',
    'button',
    'a'
  ],
  cartButtonTexts: [
    "View cart",
    "View order",
    "Cart",
    /view\s+(cart|order)/i
  ],
  cartButtonSelectors: [
    'a[href*="/cart"]',
    'button[aria-label*="cart" i]',
    'button[aria-label*="basket" i]',
    'a[aria-label*="cart" i]',
    'a[aria-label*="basket" i]',
    'button:has-text("View cart")',
    'button:has-text("View order")'
  ],
  addToCartButtonTexts: [
    /add\s+\d+\s+to\s+(cart|order)/i,
    /add\s+to\s+(cart|order)/i,
    /add\s+item/i
  ],
  blockedTexts: [
    "captcha",
    "verify you are human",
    "verifying you are human",
    "please confirm your reservation",
    "just a moment",
    "sign in to continue",
    "access denied"
  ],
  blockedStatusCodes: [401, 429]
};

export class DoorDashAdapter implements PlatformAdapter {
  readonly platform = config.platform;
  readonly label = config.label;
  readonly homepageUrl = config.homepageUrl;
  readonly crawlerBlockedStatusCodes = config.blockedStatusCodes;

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
