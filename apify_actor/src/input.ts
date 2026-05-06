import {
  PLATFORMS,
  type ActorInput,
  type ActorProxyConfigurationInput,
  type CartItemRequest,
  type Platform,
  type PlatformQuote
} from "./types.js";

const DEFAULT_MAX_CANDIDATES = 3;

export function validateInput(raw: unknown): ActorInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Actor input must be an object.");
  }

  const record = raw as Record<string, unknown>;
  const address = requireNonEmptyString(record.address, "address");
  const query = requireNonEmptyString(record.query, "query");
  const restaurantName = optionalNonEmptyString(record.restaurantName);
  const cartItems = parseCartItems(record.cartItems);
  const platforms = parsePlatforms(record.platforms);
  const userVisibleSnapshots = parseUserVisibleSnapshots(record.userVisibleSnapshots, cartItems);
  const platformStartUrls = parsePlatformStartUrls(record.platformStartUrls);
  const proxyConfiguration = parseProxyConfiguration(record.proxyConfiguration, "proxyConfiguration");
  const platformProxyConfigurations = parsePlatformProxyConfigurations(
    record.platformProxyConfigurations,
    "platformProxyConfigurations"
  );
  const proxyUrl = optionalNonEmptyString(record.proxyUrl);
  const platformProxyUrls = parsePlatformStringMap(record.platformProxyUrls, "platformProxyUrls");
  const browserUserDataDir = optionalNonEmptyString(record.browserUserDataDir);
  const platformBrowserUserDataDirs = parsePlatformStringMap(
    record.platformBrowserUserDataDirs,
    "platformBrowserUserDataDirs"
  );
  const maxCandidatesPerPlatform = parsePositiveInteger(
    record.maxCandidatesPerPlatform,
    DEFAULT_MAX_CANDIDATES,
    "maxCandidatesPerPlatform"
  );

  return {
    address,
    restaurantName,
    query,
    cartItems,
    platforms,
    userVisibleSnapshots,
    platformStartUrls,
    proxyConfiguration,
    platformProxyConfigurations,
    proxyUrl,
    platformProxyUrls,
    browserUserDataDir,
    platformBrowserUserDataDirs,
    maxCandidatesPerPlatform,
    debug: Boolean(record.debug)
  };
}

function parsePlatformStartUrls(value: unknown): ActorInput["platformStartUrls"] {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("platformStartUrls must be an object keyed by platform.");
  }

  const output: ActorInput["platformStartUrls"] = {};
  for (const [platform, url] of Object.entries(value as Record<string, unknown>)) {
    if (!isPlatform(platform)) {
      throw new Error(`platformStartUrls contains unsupported platform "${platform}".`);
    }
    if (typeof url !== "string" || !url.trim()) {
      throw new Error(`platformStartUrls.${platform} must be a non-empty URL string.`);
    }
    output[platform] = url.trim();
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function parsePlatformStringMap(
  value: unknown,
  field: string
): Partial<Record<Platform, string>> | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object keyed by platform.`);
  }

  const output: Partial<Record<Platform, string>> = {};
  for (const [platform, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!isPlatform(platform)) {
      throw new Error(`${field} contains unsupported platform "${platform}".`);
    }
    if (typeof rawValue !== "string" || !rawValue.trim()) {
      throw new Error(`${field}.${platform} must be a non-empty string.`);
    }
    output[platform] = rawValue.trim();
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export function toMealDealRequest(input: ActorInput) {
  return {
    address: input.address,
    restaurantName: input.restaurantName,
    query: input.query,
    cartItems: input.cartItems,
    platforms: input.platforms
  };
}

function parseUserVisibleSnapshots(
  value: unknown,
  cartItems: CartItemRequest[]
): PlatformQuote[] | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error("userVisibleSnapshots must be an array.");
  }

  const snapshots = value.map((snapshot, index) => {
    if (!snapshot || typeof snapshot !== "object") {
      throw new Error(`userVisibleSnapshots[${index}] must be an object.`);
    }

    const record = snapshot as Record<string, unknown>;
    const platform = parsePlatformValue(record.platform, `userVisibleSnapshots[${index}].platform`);
    const finalTotal = nullableNumber(record.finalTotal, `userVisibleSnapshots[${index}].finalTotal`);
    const itemSubtotal = nullableNumber(record.itemSubtotal, `userVisibleSnapshots[${index}].itemSubtotal`);
    const status = parseQuoteStatus(record.status, finalTotal, itemSubtotal);

    return {
      platform,
      status,
      restaurantName: nullableString(record.restaurantName),
      restaurantUrl: nullableString(record.restaurantUrl),
      matchedItemName: nullableString(record.matchedItemName),
      requestedItemName: nullableString(record.requestedItemName) ?? cartItems[0].name,
      matchScore: nullableNumber(record.matchScore, `userVisibleSnapshots[${index}].matchScore`),
      itemSubtotal,
      deliveryFee: nullableNumber(record.deliveryFee, `userVisibleSnapshots[${index}].deliveryFee`),
      serviceFee: nullableNumber(record.serviceFee, `userVisibleSnapshots[${index}].serviceFee`),
      smallOrderFee: nullableNumber(record.smallOrderFee, `userVisibleSnapshots[${index}].smallOrderFee`),
      tax: nullableNumber(record.tax, `userVisibleSnapshots[${index}].tax`),
      discount: nullableNumber(record.discount, `userVisibleSnapshots[${index}].discount`),
      finalTotal,
      promoText: nullableString(record.promoText),
      eta: nullableString(record.eta),
      checkoutUrl: nullableString(record.checkoutUrl),
      quoteLevel: parseQuoteLevel(record.quoteLevel, finalTotal, itemSubtotal),
      confidence: parseConfidence(record.confidence, finalTotal, itemSubtotal),
      warnings:
        record.warnings == null
          ? []
          : parseStringArray(record.warnings, `userVisibleSnapshots[${index}].warnings`),
      rawEvidence: parseRawEvidence(record.rawEvidence, `userVisibleSnapshots[${index}].rawEvidence`)
    } satisfies PlatformQuote;
  });

  return snapshots.length > 0 ? snapshots : undefined;
}

function parseProxyConfiguration(
  value: unknown,
  field: string
): ActorProxyConfigurationInput | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }

  const record = value as Record<string, unknown>;
  const output: ActorProxyConfigurationInput = {};
  if (record.useApifyProxy != null) {
    if (typeof record.useApifyProxy !== "boolean") {
      throw new Error(`${field}.useApifyProxy must be a boolean.`);
    }
    output.useApifyProxy = record.useApifyProxy;
  }
  output.groups = optionalStringArray(record.groups, `${field}.groups`);
  output.countryCode = optionalNonEmptyString(record.countryCode);
  output.apifyProxyGroups = optionalStringArray(record.apifyProxyGroups, `${field}.apifyProxyGroups`);
  output.apifyProxyCountry = optionalNonEmptyString(record.apifyProxyCountry);
  output.proxyUrls = optionalStringArray(record.proxyUrls, `${field}.proxyUrls`);
  if (record.checkAccess != null) {
    if (typeof record.checkAccess !== "boolean") {
      throw new Error(`${field}.checkAccess must be a boolean.`);
    }
    output.checkAccess = record.checkAccess;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function parsePlatformProxyConfigurations(
  value: unknown,
  field: string
): Partial<Record<Platform, ActorProxyConfigurationInput>> | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object keyed by platform.`);
  }

  const output: Partial<Record<Platform, ActorProxyConfigurationInput>> = {};
  for (const [platform, rawConfig] of Object.entries(value as Record<string, unknown>)) {
    if (!isPlatform(platform)) {
      throw new Error(`${field} contains unsupported platform "${platform}".`);
    }
    const config = parseProxyConfiguration(rawConfig, `${field}.${platform}`);
    if (config) {
      output[platform] = config;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function parseCartItems(value: unknown): CartItemRequest[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("cartItems must be a non-empty array.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`cartItems[${index}] must be an object.`);
    }

    const record = item as Record<string, unknown>;
    return {
      name: requireNonEmptyString(record.name, `cartItems[${index}].name`),
      quantity: parsePositiveInteger(record.quantity, 1, `cartItems[${index}].quantity`)
    };
  });
}

function parsePlatforms(value: unknown): Platform[] {
  const rawPlatforms = Array.isArray(value) && value.length > 0 ? value : [...PLATFORMS];
  const platforms = rawPlatforms.map((platform, index) => {
    return parsePlatformValue(platform, `platforms[${index}]`);
  });

  return Array.from(new Set(platforms));
}

function parsePlatformValue(value: unknown, field: string): Platform {
  if (typeof value !== "string" || !isPlatform(value)) {
    throw new Error(`${field} must be one of: ${PLATFORMS.join(", ")}.`);
  }
  return value;
}

function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function nullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return optionalNonEmptyString(value) ?? null;
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number or null.`);
  }
  return value;
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value == null) {
    return undefined;
  }
  return parseStringArray(value, field);
}

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of strings.`);
  }
  return value
    .map((item, index) => {
      if (typeof item !== "string" || !item.trim()) {
        throw new Error(`${field}[${index}] must be a non-empty string.`);
      }
      return item.trim();
    })
    .filter(Boolean);
}

function parseQuoteStatus(
  value: unknown,
  finalTotal: number | null,
  itemSubtotal: number | null
): PlatformQuote["status"] {
  if (value == null || value === "") {
    return finalTotal == null && itemSubtotal == null ? "partial" : "success";
  }
  if (value === "success" || value === "partial" || value === "failed") {
    return value;
  }
  throw new Error("userVisibleSnapshots status must be success, partial, or failed.");
}

function parseQuoteLevel(
  value: unknown,
  finalTotal: number | null,
  itemSubtotal: number | null
): PlatformQuote["quoteLevel"] {
  if (value == null || value === "") {
    return finalTotal != null ? "checkout" : itemSubtotal != null ? "cart" : "unknown";
  }
  if (
    value === "menu" ||
    value === "cart" ||
    value === "pre_checkout" ||
    value === "checkout" ||
    value === "unknown"
  ) {
    return value;
  }
  throw new Error("userVisibleSnapshots quoteLevel must be menu, cart, pre_checkout, checkout, or unknown.");
}

function parseConfidence(
  value: unknown,
  finalTotal: number | null,
  itemSubtotal: number | null
): PlatformQuote["confidence"] {
  if (value == null || value === "") {
    return finalTotal != null || itemSubtotal != null ? "high" : "medium";
  }
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  throw new Error("userVisibleSnapshots confidence must be high, medium, or low.");
}

function parseRawEvidence(value: unknown, field: string): Record<string, string | null> | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }

  const output: Record<string, string | null> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (rawValue == null) {
      output[key] = null;
    } else if (typeof rawValue === "string") {
      output[key] = rawValue;
    } else {
      output[key] = String(rawValue);
    }
  }
  return output;
}

function parsePositiveInteger(value: unknown, fallback: number, field: string): number {
  if (value == null || value === "") {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return value;
}
