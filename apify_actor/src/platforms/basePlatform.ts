import type { Page } from "playwright";
import type { ActorInput, Platform, PlatformQuote } from "../types.js";

export type ClickTarget = string | RegExp;

export type RestaurantCandidate = {
  platform: Platform;
  name: string;
  url: string | null;
  rawText: string;
  rating: number | null;
  eta: string | null;
  deliveryAvailable: boolean;
  score: number | null;
};

export type MenuItemCandidate = {
  name: string;
  price: number | null;
  rawText: string;
  matchScore: number | null;
};

export type PlatformConfig = {
  platform: Platform;
  label: string;
  homepageUrl: string;
  searchUrl: (term: string) => string;
  addressInputSelectors: string[];
  addressSuggestionSelectors: string[];
  addressSubmitSelectors: string[];
  searchInputSelectors: string[];
  restaurantUrlPatterns: RegExp[];
  menuItemSelectorHints: string[];
  cartButtonTexts: ClickTarget[];
  cartButtonSelectors?: string[];
  addToCartButtonTexts: ClickTarget[];
  blockedTexts: string[];
  blockedStatusCodes?: number[];
};

export type PlatformQuoteContext = {
  restaurant: RestaurantCandidate | null;
  menuItem: MenuItemCandidate | null;
  flowWarnings: string[];
};

export interface PlatformAdapter {
  readonly platform: Platform;
  readonly label: string;
  readonly homepageUrl: string;
  readonly crawlerBlockedStatusCodes?: number[];

  searchRestaurants(page: Page, input: ActorInput): Promise<RestaurantCandidate[]>;
  openRestaurant(
    page: Page,
    candidate: RestaurantCandidate,
    input: ActorInput
  ): Promise<string[]>;
  findMenuItem(page: Page, input: ActorInput): Promise<MenuItemCandidate | null>;
  addItemToCart(
    page: Page,
    item: MenuItemCandidate,
    input: ActorInput
  ): Promise<string[]>;
  openQuotePage(page: Page, input: ActorInput): Promise<string[]>;
  extractQuote(
    page: Page,
    input: ActorInput,
    context: PlatformQuoteContext
  ): Promise<PlatformQuote>;
}

export function platformLabel(platform: Platform): string {
  return {
    ubereats: "Uber Eats",
    doordash: "DoorDash",
    grubhub: "Grubhub"
  }[platform];
}

export function resolvePlatformStartUrl(
  input: ActorInput,
  config: PlatformConfig
): string {
  return input.platformStartUrls?.[config.platform] ?? config.homepageUrl;
}

export function makeFailedQuote(
  platform: Platform,
  input: ActorInput,
  warnings: string[],
  restaurant: RestaurantCandidate | null = null,
  item: MenuItemCandidate | null = null
): PlatformQuote {
  return {
    platform,
    status: "failed",
    restaurantName: restaurant?.name ?? null,
    restaurantUrl: restaurant?.url ?? null,
    matchedItemName: item?.name ?? null,
    requestedItemName: input.cartItems[0]?.name ?? null,
    matchScore: item?.matchScore ?? null,
    itemSubtotal: item?.price != null ? Number((item.price * input.cartItems[0].quantity).toFixed(2)) : null,
    deliveryFee: null,
    serviceFee: null,
    smallOrderFee: null,
    tax: null,
    discount: null,
    finalTotal: null,
    promoText: null,
    eta: restaurant?.eta ?? null,
    checkoutUrl: null,
    quoteLevel: "unknown",
    confidence: "low",
    warnings: Array.from(new Set(warnings)),
    rawEvidence: warnings.length ? { error: warnings.join(" ") } : undefined
  };
}
