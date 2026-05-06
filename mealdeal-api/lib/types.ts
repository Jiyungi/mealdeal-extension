// Shared type contract with the MealDeal Apify Actor and the Chrome extension.
// Keep in sync with apify_actor/src/types.ts and
// mealdeal-extension/src/lib/types.ts.

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
  doorDashStoreUrls?: string[];
  userVisibleSnapshots?: PlatformQuote[];
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

export type RunMealDealResponse =
  | { status: "complete"; result: MealDealResult }
  | { status: "running" | "queued"; runId: string }
  | { status: "error"; message: string };

export type ActorStatusResponse =
  | { status: "running" | "queued"; runId: string }
  | { status: "complete"; runId: string; result: MealDealResult }
  | { status: "error"; runId: string; message: string };
