import { describe, expect, it } from "vitest";
import type { PlatformQuote } from "./types";
import {
  platformHomepage,
  platformLabel,
  platformOpenUrl,
} from "./platformLinks";

function makeQuote(parts: Partial<PlatformQuote>): PlatformQuote {
  return {
    platform: "ubereats",
    status: "success",
    restaurantName: null,
    restaurantUrl: null,
    matchedItemName: null,
    requestedItemName: null,
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
    warnings: [],
    ...parts,
  };
}

describe("platformLabel", () => {
  it("returns a human label for every platform", () => {
    expect(platformLabel("ubereats")).toBe("Uber Eats");
    expect(platformLabel("doordash")).toBe("DoorDash");
    expect(platformLabel("grubhub")).toBe("Grubhub");
  });
});

describe("platformOpenUrl", () => {
  it("prefers the checkout URL when available", () => {
    const q = makeQuote({
      platform: "doordash",
      checkoutUrl: "https://www.doordash.com/checkout/abc",
      restaurantUrl: "https://www.doordash.com/store/xyz",
    });
    expect(platformOpenUrl(q)).toBe("https://www.doordash.com/checkout/abc");
  });

  it("falls back to the restaurant URL", () => {
    const q = makeQuote({
      platform: "grubhub",
      checkoutUrl: null,
      restaurantUrl: "https://www.grubhub.com/restaurant/thai-time",
    });
    expect(platformOpenUrl(q)).toBe(
      "https://www.grubhub.com/restaurant/thai-time",
    );
  });

  it("falls back to the homepage when neither URL is available", () => {
    const q = makeQuote({ platform: "ubereats" });
    expect(platformOpenUrl(q)).toBe(platformHomepage("ubereats"));
  });
});
