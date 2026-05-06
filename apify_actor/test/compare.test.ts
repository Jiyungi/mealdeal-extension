import { describe, expect, it } from "vitest";
import { buildReason } from "../src/comparison/buildReason.js";
import { chooseBestPlatform } from "../src/comparison/chooseBestPlatform.js";
import { compareQuotes } from "../src/comparison/compareQuotes.js";
import type { PlatformQuote } from "../src/types.js";

describe("quote comparison", () => {
  it("chooses the lowest visible cart subtotal", () => {
    const quotes = [
      quote("ubereats", 16.99, 19.9),
      quote("doordash", 15.99, 24.18),
      quote("grubhub", 17.49, 26.98)
    ];

    const comparison = compareQuotes(quotes);
    expect(comparison.bestPlatform).toBe("doordash");
    expect(comparison.comparisonBasis).toBe("itemSubtotal");
    expect(comparison.savingsVsMostExpensive).toBe(1.5);
    expect(comparison.savingsVsSecondBest).toBe(1);
    expect(chooseBestPlatform(quotes)).toBe("doordash");
    expect(buildReason(comparison)).toContain("DoorDash");
  });

  it("does not choose a platform from final totals alone", () => {
    const comparison = compareQuotes([
      { ...quote("ubereats", null, 19.9), itemSubtotal: null },
      { ...quote("doordash", null, 24.18), itemSubtotal: null }
    ]);

    expect(comparison.bestPlatform).toBeNull();
    expect(comparison.comparisonBasis).toBeNull();
    expect(buildReason(comparison)).toContain("could not choose");
  });

  it("does not choose a failed or subtotal-less platform", () => {
    const comparison = compareQuotes([
      { ...quote("ubereats", null, null), status: "partial" },
      { ...quote("doordash", 12.99, null), status: "failed" }
    ]);

    expect(comparison.bestPlatform).toBeNull();
    expect(buildReason(comparison)).toContain("could not choose");
  });
});

function quote(
  platform: PlatformQuote["platform"],
  itemSubtotal: number | null,
  finalTotal: number | null
): PlatformQuote {
  return {
    platform,
    status: itemSubtotal == null && finalTotal == null ? "partial" : "success",
    restaurantName: "Thai Time",
    restaurantUrl: "https://example.com",
    matchedItemName: "Chicken Pad Thai",
    requestedItemName: "Chicken Pad Thai",
    matchScore: 0.94,
    itemSubtotal,
    deliveryFee: 2.99,
    serviceFee: 3.1,
    smallOrderFee: 0,
    tax: 1.82,
    discount: 5,
    finalTotal,
    promoText: "Save $5",
    eta: "25-35 min",
    checkoutUrl: "https://example.com/cart",
    quoteLevel: "pre_checkout",
    confidence: itemSubtotal == null && finalTotal == null ? "low" : "high",
    warnings: [],
    rawEvidence: {}
  };
}
