// Shared type contract with the MealDeal Apify Actor (see mealdeal-actor/src/types.ts).
// Keep these in sync with Person B's types verbatim.

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

// Context extracted from the user's currently open platform tab.
// Built by content scripts on demand and used to pre-fill the MealDeal request
// so the user can compare with one click instead of filling a form.
export type PageContext = {
  platform: Platform;
  url: string;
  address: string | null;
  restaurantName: string | null;
  restaurantUrl: string | null;
  cartItems: CartItemRequest[];
  snapshot: PlatformQuote;
};

// Response envelope returned by the thin backend at POST /api/run-mealdeal.
// The backend may respond either with the final MealDealResult (sync wait)
// or with a run handle that the popup polls via /api/actor-status.
export type RunMealDealResponse =
  | {
      status: "complete";
      result: MealDealResult;
    }
  | {
      status: "running" | "queued";
      runId: string;
    }
  | {
      status: "error";
      message: string;
    };

export type ActorStatusResponse =
  | { status: "running" | "queued"; runId: string }
  | { status: "complete"; runId: string; result: MealDealResult }
  | { status: "error"; runId: string; message: string };
