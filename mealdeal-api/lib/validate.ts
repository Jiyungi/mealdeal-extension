import type { MealDealRequest, Platform, PlatformQuote } from "./types";
import { PLATFORMS } from "./types";

export type ValidatedRequest = MealDealRequest & {
  maxCandidatesPerPlatform: number;
  debug: boolean;
};

export type ValidateResult =
  | { ok: true; input: ValidatedRequest }
  | { ok: false; error: string };

export function validateMealDealRequest(raw: unknown): ValidateResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Body must be an object." };
  }
  const r = raw as Record<string, unknown>;

  const address = typeof r.address === "string" ? r.address.trim() : "";
  if (!address) return { ok: false, error: "`address` is required." };

  const query = typeof r.query === "string" ? r.query.trim() : "";
  if (!query) return { ok: false, error: "`query` is required." };

  const restaurantName =
    typeof r.restaurantName === "string" && r.restaurantName.trim().length > 0
      ? r.restaurantName.trim()
      : undefined;

  if (!Array.isArray(r.cartItems) || r.cartItems.length === 0) {
    return { ok: false, error: "`cartItems` must be a non-empty array." };
  }
  const cartItems: MealDealRequest["cartItems"] = [];
  for (let i = 0; i < r.cartItems.length; i++) {
    const raw = r.cartItems[i] as Record<string, unknown>;
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    if (!name) {
      return { ok: false, error: `cartItems[${i}].name is required.` };
    }
    const quantity =
      typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
        ? Math.max(1, Math.floor(raw.quantity))
        : 1;
    cartItems.push({ name, quantity });
  }

  if (!Array.isArray(r.platforms) || r.platforms.length === 0) {
    return { ok: false, error: "`platforms` must be a non-empty array." };
  }
  const platforms: Platform[] = [];
  for (const p of r.platforms) {
    if (typeof p !== "string" || !PLATFORMS.includes(p as Platform)) {
      return { ok: false, error: `Unknown platform: ${String(p)}` };
    }
    platforms.push(p as Platform);
  }

  return {
    ok: true,
    input: {
      address,
      query,
      restaurantName,
      cartItems,
      platforms,
      userVisibleSnapshots: Array.isArray(r.userVisibleSnapshots)
        ? (r.userVisibleSnapshots as PlatformQuote[])
        : undefined,
      maxCandidatesPerPlatform: 3,
      debug: false,
    },
  };
}
