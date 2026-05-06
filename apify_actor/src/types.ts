export const PLATFORMS = ["ubereats", "doordash", "grubhub"] as const;

export type Platform = (typeof PLATFORMS)[number];

export type CartItemRequest = {
  name: string;
  quantity: number;
};

export type MealDealRequest = {
  address: string;
  restaurantName?: string;
  query: string;
  cartItems: CartItemRequest[];
  platforms: Platform[];
  userVisibleSnapshots?: PlatformQuote[];
};

export type ActorProxyConfigurationInput = {
  useApifyProxy?: boolean;
  groups?: string[];
  countryCode?: string;
  apifyProxyGroups?: string[];
  apifyProxyCountry?: string;
  proxyUrls?: string[];
  checkAccess?: boolean;
};

export type PlatformQuote = {
  platform: Platform;
  status: "success" | "partial" | "failed";
  restaurantName: string | null;
  restaurantUrl: string | null;
  matchedItemName: string | null;
  requestedItemName: string | null;
  matchScore: number | null;
  itemSubtotal: number | null;
  deliveryFee: number | null;
  serviceFee: number | null;
  smallOrderFee: number | null;
  tax: number | null;
  discount: number | null;
  finalTotal: number | null;
  promoText: string | null;
  eta: string | null;
  checkoutUrl: string | null;
  quoteLevel: "menu" | "cart" | "pre_checkout" | "checkout" | "unknown";
  confidence: "high" | "medium" | "low";
  warnings: string[];
  rawEvidence?: Record<string, string | null>;
};

export type MealDealResult = {
  input: MealDealRequest;
  bestPlatform: Platform | null;
  bestQuote: PlatformQuote | null;
  quotes: PlatformQuote[];
  savingsVsMostExpensive: number | null;
  savingsVsSecondBest: number | null;
  reason: string;
  warnings: string[];
  createdAt: string;
};

export type ActorInput = MealDealRequest & {
  maxCandidatesPerPlatform: number;
  debug: boolean;
  platformStartUrls?: Partial<Record<Platform, string>>;
  proxyConfiguration?: ActorProxyConfigurationInput;
  platformProxyConfigurations?: Partial<Record<Platform, ActorProxyConfigurationInput>>;
  proxyUrl?: string;
  platformProxyUrls?: Partial<Record<Platform, string>>;
  browserUserDataDir?: string;
  platformBrowserUserDataDirs?: Partial<Record<Platform, string>>;
};
