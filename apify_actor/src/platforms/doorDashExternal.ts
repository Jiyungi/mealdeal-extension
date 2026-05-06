import { Actor, log } from "apify";
import type { ActorInput, PlatformQuote } from "../types.js";
import { matchItem } from "../matching/matchItem.js";
import { parseMoney, parseMoneyValues } from "../utils/parseMoney.js";
import type { MenuItemCandidate } from "./basePlatform.js";

const DOORDASH_URL_PATTERN = /^https?:\/\/(?:www\.)?doordash\.com\/store\//i;
const ANY_DOORDASH_STORE_URL_PATTERN = /https?:\/\/(?:www\.)?doordash\.com\/store\/[^\s"'<>]+/gi;

type ExternalActorAttempt = {
  actorId: string;
  label: string;
  timeoutSecs: number;
  input: Record<string, unknown>;
};

type ExternalMenuCandidate = MenuItemCandidate & {
  priceText: string | null;
  section: string | null;
  restaurantName: string | null;
  restaurantUrl: string | null;
  evidenceText: string;
};

type ExternalRestaurantEvidence = {
  restaurantName: string | null;
  restaurantUrl: string | null;
  address: string | null;
};

export function resolveDoorDashStoreUrls(input: ActorInput): string[] {
  return Array.from(
    new Set(
      [
        ...(input.doorDashStoreUrls ?? []),
        input.platformStartUrls?.doordash ?? null
      ]
        .filter((url): url is string => typeof url === "string" && DOORDASH_URL_PATTERN.test(url.trim()))
        .map((url) => url.trim())
    )
  );
}

export async function runDoorDashExternalQuoteFlow(
  input: ActorInput
): Promise<PlatformQuote | null> {
  if (!input.doorDashUseExternalActors) {
    return null;
  }

  const directStoreUrls = resolveDoorDashStoreUrls(input);
  if (directStoreUrls.length > 0) {
    return runDirectStoreActorFallbacks(input, directStoreUrls, []);
  }

  const discovery = await runDiscoveryActorFallbacks(input);
  if (discovery.quote) {
    return discovery.quote;
  }
  if (discovery.storeUrls.length > 0) {
    return runDirectStoreActorFallbacks(input, discovery.storeUrls, discovery.warnings);
  }

  return null;
}

async function runDirectStoreActorFallbacks(
  input: ActorInput,
  storeUrls: string[],
  inheritedWarnings: string[]
): Promise<PlatformQuote> {
  const attempts = buildDirectStoreAttempts(storeUrls);
  const warnings = [...inheritedWarnings];
  let bestPartial: PlatformQuote | null = null;

  for (const attempt of attempts) {
    try {
      log.info("Running DoorDash external menu Actor.", {
        actorId: attempt.actorId,
        storeUrlCount: storeUrls.length
      });
      const items = await callExternalActor(attempt);
      const quote = normalizeDoorDashExternalQuote(input, items, attempt.actorId, attempt.label, warnings);

      if (quote.itemSubtotal != null) {
        return quote;
      }
      if (!bestPartial || rankExternalQuote(quote) > rankExternalQuote(bestPartial)) {
        bestPartial = quote;
      }
      warnings.push(...quote.warnings);
    } catch (error) {
      warnings.push(formatExternalActorError(attempt, error));
    }
  }

  if (bestPartial) {
    return withWarnings(bestPartial, warnings);
  }

  return makeDoorDashExternalFailedQuote(input, [
    ...warnings,
    "DoorDash external menu actors did not return usable menu data."
  ]);
}

async function runDiscoveryActorFallbacks(input: ActorInput): Promise<{
  quote: PlatformQuote | null;
  storeUrls: string[];
  warnings: string[];
}> {
  const attempts = buildDiscoveryAttempts(input);
  const warnings: string[] = [];

  for (const attempt of attempts) {
    try {
      log.info("Running DoorDash external discovery Actor.", {
        actorId: attempt.actorId,
        query: input.restaurantName ?? input.query
      });
      const items = await callExternalActor(attempt);
      const quote = normalizeDoorDashExternalQuote(input, items, attempt.actorId, attempt.label, warnings);

      if (quote.itemSubtotal != null) {
        return { quote, storeUrls: [], warnings };
      }

      const storeUrls = extractDoorDashStoreUrls(items);
      if (storeUrls.length > 0) {
        return { quote: null, storeUrls, warnings };
      }
      warnings.push(...quote.warnings);
    } catch (error) {
      warnings.push(formatExternalActorError(attempt, error));
    }
  }

  return { quote: null, storeUrls: [], warnings };
}

function buildDirectStoreAttempts(storeUrls: string[]): ExternalActorAttempt[] {
  return [
    {
      actorId: "crawlerbros/doordash-restaurant-scraper",
      label: "CrawlerBros DoorDash Restaurant Scraper",
      timeoutSecs: 240,
      input: {
        storeUrls,
        maxItems: Math.max(1, storeUrls.length)
      }
    },
    {
      actorId: "memo23/doordash-reviews-cheerio",
      label: "memo23 DoorDash Meta/Menu Actor",
      timeoutSecs: 240,
      input: {
        startUrls: storeUrls.map((url) => ({ url })),
        includeAllReviews: false,
        includeAllMenuVariants: false,
        region: "US",
        maxItems: Math.max(1, storeUrls.length),
        maxConcurrency: 1,
        minConcurrency: 1,
        maxRequestRetries: 3,
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ["RESIDENTIAL"]
        }
      }
    },
    {
      actorId: "nifty.codes/doordash-menu-scraper",
      label: "Nifty DoorDash Menu Scraper",
      timeoutSecs: 180,
      input: {
        urls: storeUrls,
        maxItems: 200
      }
    },
    {
      actorId: "yasmany.casanova/doordash-restaurant-scraper",
      label: "Yasmany DoorDash Restaurant Scraper",
      timeoutSecs: 240,
      input: {
        mode: "menu",
        store_url: storeUrls[0],
        useApifyProxy: true,
        proxyCountry: "US",
        headless: true,
        maxRetries: 3
      }
    }
  ];
}

function buildDiscoveryAttempts(input: ActorInput): ExternalActorAttempt[] {
  const query = input.restaurantName ?? input.query;
  const searchTerm = [query, input.address].join(" ");
  const searchUrl = `https://www.doordash.com/search/store/${encodeURIComponent(searchTerm)}/`;

  return [
    {
      actorId: "sovereigntaylor/doordash-scraper",
      label: "SovereignTaylor DoorDash Scraper",
      timeoutSecs: 240,
      input: {
        locations: [input.address],
        cuisine: query,
        includeMenus: true,
        maxResults: input.maxCandidatesPerPlatform,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ["RESIDENTIAL"]
        }
      }
    },
    {
      actorId: "nifty.codes/doordash-stores-scraper",
      label: "Nifty DoorDash Store List Scraper",
      timeoutSecs: 180,
      input: {
        urls: [searchUrl],
        maxItems: input.maxCandidatesPerPlatform,
        maxPages: 1,
        enablePagination: false
      }
    },
    {
      actorId: "axlymxp/doordash-store-scraper",
      label: "Axly DoorDash Store Scraper",
      timeoutSecs: 180,
      input: {
        query: searchTerm,
        radius: 10
      }
    }
  ];
}

async function callExternalActor(attempt: ExternalActorAttempt): Promise<Record<string, unknown>[]> {
  if (!process.env.APIFY_TOKEN && !Actor.isAtHome()) {
    throw new Error("APIFY_TOKEN is required for local runs that call Apify Store Actors.");
  }

  const run = await Actor.call(attempt.actorId, attempt.input, { timeout: attempt.timeoutSecs });
  if (!run.defaultDatasetId) {
    return [];
  }

  const { items } = await Actor.apifyClient.dataset(run.defaultDatasetId).listItems({ limit: 1000 });
  return items as Record<string, unknown>[];
}

export function normalizeDoorDashExternalQuote(
  input: ActorInput,
  items: unknown[],
  actorId = "unknown",
  actorLabel = actorId,
  inheritedWarnings: string[] = []
): PlatformQuote {
  const evidence = extractRestaurantEvidence(items);
  const candidates = extractExternalMenuCandidates(items, evidence);
  const requestedItem = input.cartItems[0];
  const matched = matchItem(requestedItem.name, candidates) as ExternalMenuCandidate | null;

  if (!items.length) {
    return makeDoorDashExternalFailedQuote(input, [
      ...inheritedWarnings,
      `${actorLabel} returned no DoorDash dataset items.`
    ]);
  }

  if (!matched) {
    return makeDoorDashExternalPartialQuote(input, evidence, null, actorId, actorLabel, candidates.length, [
      ...inheritedWarnings,
      `${actorLabel} returned DoorDash data, but no menu item matched "${requestedItem.name}".`
    ]);
  }

  const subtotal = subtotalFromDoorDashPrice(matched.priceText, requestedItem.quantity, matched.price);
  if (subtotal == null) {
    return makeDoorDashExternalPartialQuote(input, evidence, matched, actorId, actorLabel, candidates.length, [
      ...inheritedWarnings,
      `${actorLabel} matched "${matched.name}", but did not expose a usable menu price.`
    ]);
  }

  const warnings = [
    ...inheritedWarnings,
    `DoorDash used ${actorLabel} external Apify Actor for menu data.`,
    "DoorDash item subtotal is derived from scraped menu price, not from a live checkout total."
  ];

  const deal = matched.priceText ? parseBundleDeal(matched.priceText) : null;
  if (deal && requestedItem.quantity % deal.count !== 0) {
    warnings.push(
      `DoorDash menu price "${matched.priceText}" is a bundle price, so subtotal rounds up to whole bundles.`
    );
  }

  return {
    platform: "doordash",
    status: "success",
    restaurantName: evidence.restaurantName ?? matched.restaurantName,
    restaurantUrl: evidence.restaurantUrl ?? matched.restaurantUrl,
    matchedItemName: matched.name,
    requestedItemName: requestedItem.name,
    matchScore: matched.matchScore,
    itemSubtotal: subtotal,
    deliveryFee: null,
    serviceFee: null,
    smallOrderFee: null,
    tax: null,
    discount: null,
    finalTotal: null,
    promoText: matched.priceText?.includes("for") ? matched.priceText : null,
    eta: null,
    checkoutUrl: evidence.restaurantUrl ?? matched.restaurantUrl,
    quoteLevel: "menu",
    confidence: "medium",
    warnings: Array.from(new Set(warnings)),
    rawEvidence: {
      externalActor: actorId,
      externalActorLabel: actorLabel,
      menuPriceText: matched.priceText,
      menuSection: matched.section,
      menuCandidateCount: String(candidates.length),
      itemRawText: truncate(matched.evidenceText, 500),
      restaurantAddress: evidence.address
    }
  };
}

export function subtotalFromDoorDashPrice(
  priceText: string | null | undefined,
  quantity: number,
  fallbackUnitPrice: number | null = null
): number | null {
  const deal = priceText ? parseBundleDeal(priceText) : null;
  if (deal) {
    return roundMoney(Math.ceil(quantity / deal.count) * deal.price);
  }

  const parsed = typeof priceText === "string" ? parseMoney(priceText) : null;
  const unitPrice = parsed ?? fallbackUnitPrice;
  if (unitPrice == null) {
    return null;
  }

  return roundMoney(unitPrice * quantity);
}

function extractExternalMenuCandidates(
  items: unknown[],
  evidence: ExternalRestaurantEvidence
): ExternalMenuCandidate[] {
  const candidates: ExternalMenuCandidate[] = [];
  for (const item of items) {
    walkMenuItems(item, evidence, null, candidates, 0, false);
  }
  return dedupeCandidates(candidates);
}

function walkMenuItems(
  value: unknown,
  evidence: ExternalRestaurantEvidence,
  section: string | null,
  candidates: ExternalMenuCandidate[],
  depth: number,
  menuContext: boolean
): void {
  if (depth > 8 || value == null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      walkMenuItems(child, evidence, section, candidates, depth + 1, menuContext);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const nextSection = firstStringByKeys(record, [
    "section",
    "sectionName",
    "category",
    "categoryName",
    "menuCategory",
    "menuSection"
  ]) ?? section;
  const itemName = firstStringByKeys(record, [
    "itemName",
    "item_name",
    "name",
    "displayName",
    "display_name",
    "title"
  ]);
  const itemDescription = firstStringByKeys(record, [
    "description",
    "itemDescription",
    "item_description",
    "subtitle",
    "summary"
  ]);
  const priceText = firstPriceText(record);
  const rawText = [itemName, itemDescription, nextSection, priceText].filter(Boolean).join(" ");
  const evidenceText = truncate(JSON.stringify(record), 900);

  if (itemName && looksLikeMenuItem(record, itemName, priceText, menuContext)) {
    candidates.push({
      name: itemName,
      price: priceText == null ? null : parseMoney(priceText),
      priceText,
      rawText: rawText || itemName,
      evidenceText,
      matchScore: null,
      section: nextSection,
      restaurantName: evidence.restaurantName,
      restaurantUrl: evidence.restaurantUrl
    });
  }

  for (const [key, child] of Object.entries(record)) {
    if (isMetadataKey(key)) {
      continue;
    }
    walkMenuItems(
      child,
      evidence,
      nextSection,
      candidates,
      depth + 1,
      menuContext || isMenuCollectionKey(key)
    );
  }
}

function looksLikeMenuItem(
  record: Record<string, unknown>,
  itemName: string,
  priceText: string | null,
  menuContext: boolean
): boolean {
  if (hasMenuContainerFields(record) && !menuContext) {
    return false;
  }
  if (!priceText && !menuContext && parseMoneyValues(JSON.stringify(record)).length === 0) {
    return false;
  }
  const normalizedName = itemName.trim().toLowerCase();
  if (!normalizedName || normalizedName.length < 2) {
    return false;
  }
  if (!hasDirectMenuShape(record, priceText, menuContext)) {
    return false;
  }
  return ![
    "doordash",
    "menu",
    "menus",
    "most ordered",
    "popular items"
  ].includes(normalizedName);
}

function firstPriceText(record: Record<string, unknown>): string | null {
  for (const key of [
    "price_display",
    "priceDisplay",
    "priceText",
    "displayPrice",
    "display_price",
    "original_price_display",
    "originalPriceDisplay",
    "itemPrice",
    "basePrice",
    "unitPrice",
    "salePrice",
    "price"
  ]) {
    const value = record[key];
    const normalized = normalizePriceValue(value);
    if (normalized != null) {
      return normalized;
    }
  }

  return null;
}

function normalizePriceValue(value: unknown): string | null {
  if (typeof value === "string") {
    return parseMoney(value) == null ? null : value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const dollars = value > 100 ? value / 100 : value;
    return `$${roundMoney(dollars).toFixed(2)}`;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return firstStringByKeys(record, [
      "displayString",
      "display_string",
      "formatted",
      "text",
      "amount"
    ]) ?? normalizePriceValue(record.amount);
  }
  return null;
}

function extractRestaurantEvidence(items: unknown[]): ExternalRestaurantEvidence {
  for (const item of items) {
    const evidence = findRestaurantEvidence(item);
    if (evidence.restaurantName || evidence.restaurantUrl || evidence.address) {
      return evidence;
    }
  }
  return { restaurantName: null, restaurantUrl: null, address: null };
}

function findRestaurantEvidence(value: unknown): ExternalRestaurantEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { restaurantName: null, restaurantUrl: null, address: null };
  }

  const record = value as Record<string, unknown>;
  const direct = {
    restaurantName: firstStringByKeys(record, [
      "storeName",
      "restaurantName",
      "businessName",
      "merchantName",
      "store_name"
    ]),
    restaurantUrl: firstStringByKeys(record, ["storeUrl", "restaurantUrl", "url", "canonicalUrl"]),
    address: firstStringByKeys(record, ["address", "streetAddress", "street", "location"])
  };

  if (direct.restaurantName || direct.restaurantUrl || direct.address) {
    return direct;
  }

  for (const child of Object.values(record)) {
    const nested = findRestaurantEvidence(child);
    if (nested.restaurantName || nested.restaurantUrl || nested.address) {
      return nested;
    }
  }

  return { restaurantName: null, restaurantUrl: null, address: null };
}

function extractDoorDashStoreUrls(items: unknown[]): string[] {
  const urls = new Set<string>();
  for (const item of items) {
    const text = JSON.stringify(item);
    for (const match of text.matchAll(ANY_DOORDASH_STORE_URL_PATTERN)) {
      urls.add(match[0].replace(/\\u002F/g, "/"));
    }
  }
  return [...urls].filter((url) => DOORDASH_URL_PATTERN.test(url));
}

function makeDoorDashExternalPartialQuote(
  input: ActorInput,
  evidence: ExternalRestaurantEvidence,
  item: ExternalMenuCandidate | null,
  actorId: string,
  actorLabel: string,
  candidateCount: number,
  warnings: string[]
): PlatformQuote {
  return {
    platform: "doordash",
    status: "partial",
    restaurantName: evidence.restaurantName ?? item?.restaurantName ?? null,
    restaurantUrl: evidence.restaurantUrl ?? item?.restaurantUrl ?? null,
    matchedItemName: item?.name ?? null,
    requestedItemName: input.cartItems[0]?.name ?? null,
    matchScore: item?.matchScore ?? null,
    itemSubtotal: null,
    deliveryFee: null,
    serviceFee: null,
    smallOrderFee: null,
    tax: null,
    discount: null,
    finalTotal: null,
    promoText: item?.priceText ?? null,
    eta: null,
    checkoutUrl: evidence.restaurantUrl ?? item?.restaurantUrl ?? null,
    quoteLevel: "menu",
    confidence: "low",
    warnings: Array.from(new Set(warnings)),
    rawEvidence: {
      externalActor: actorId,
      externalActorLabel: actorLabel,
      menuPriceText: item?.priceText ?? null,
      menuSection: item?.section ?? null,
      menuCandidateCount: String(candidateCount),
      restaurantAddress: evidence.address
    }
  };
}

function makeDoorDashExternalFailedQuote(input: ActorInput, warnings: string[]): PlatformQuote {
  return {
    platform: "doordash",
    status: "failed",
    restaurantName: null,
    restaurantUrl: null,
    matchedItemName: null,
    requestedItemName: input.cartItems[0]?.name ?? null,
    matchScore: null,
    itemSubtotal: null,
    deliveryFee: null,
    serviceFee: null,
    smallOrderFee: null,
    tax: null,
    discount: null,
    finalTotal: null,
    promoText: null,
    eta: null,
    checkoutUrl: null,
    quoteLevel: "unknown",
    confidence: "low",
    warnings: Array.from(new Set(warnings)),
    rawEvidence: { error: warnings.join(" ") }
  };
}

function withWarnings(quote: PlatformQuote, warnings: string[]): PlatformQuote {
  return {
    ...quote,
    warnings: Array.from(new Set([...quote.warnings, ...warnings]))
  };
}

function rankExternalQuote(quote: PlatformQuote): number {
  const subtotalRank = quote.itemSubtotal == null ? 0 : 100;
  const statusRank = quote.status === "success" ? 50 : quote.status === "partial" ? 25 : 0;
  const matchRank = quote.matchScore == null ? 0 : quote.matchScore;
  return subtotalRank + statusRank + matchRank;
}

function parseBundleDeal(priceText: string): { count: number; price: number } | null {
  const match = priceText.match(/(\d+)\s*(?:for|\/)\s*\$\s*([0-9]+(?:\.[0-9]{2})?)/i);
  if (!match) {
    return null;
  }
  const count = Number(match[1]);
  const price = Number(match[2]);
  if (!Number.isFinite(count) || count < 1 || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  return { count, price };
}

function firstStringByKeys(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function isMetadataKey(key: string): boolean {
  return [
    "reviews",
    "review",
    "ratings",
    "rating",
    "images",
    "image",
    "photos",
    "photo"
  ].includes(key.toLowerCase());
}

function hasMenuContainerFields(record: Record<string, unknown>): boolean {
  return ["menuItems", "menuSections", "items", "products"].some((key) => key in record);
}

function hasDirectMenuShape(
  record: Record<string, unknown>,
  priceText: string | null,
  menuContext: boolean
): boolean {
  if (priceText != null) {
    return true;
  }
  if (menuContext && (typeof record.name === "string" || typeof record.itemName === "string")) {
    return true;
  }
  return ["item_id", "itemId", "category", "section", "menuCategory", "menuSection", "price_display"].some(
    (key) => key in record
  );
}

function isMenuCollectionKey(key: string): boolean {
  return ["menuitems", "items", "menu", "menus", "products", "results"].includes(key.toLowerCase());
}

function formatExternalActorError(attempt: ExternalActorAttempt, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/rent a paid Actor/i.test(message)) {
    return `${attempt.label} requires renting the paid Apify Store Actor before MealDeal can use it.`;
  }
  return `${attempt.label} failed: ${message}`;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function dedupeCandidates(candidates: ExternalMenuCandidate[]): ExternalMenuCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = [
      candidate.name.toLowerCase(),
      candidate.priceText ?? "",
      candidate.section ?? ""
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}
