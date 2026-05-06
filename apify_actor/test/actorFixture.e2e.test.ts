import { describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { compareQuotes } from "../src/comparison/compareQuotes.js";
import { runAllPlatforms } from "../src/flows/runAllPlatforms.js";
import { validateInput } from "../src/input.js";

describe("Actor fixture scraper flow", () => {
  it("extracts complete normalized quotes from all platform fixtures", async () => {
    const input = validateInput({
      address: "525 Market St, San Francisco, CA",
      query: "Chicken Pad Thai",
      cartItems: [{ name: "Chicken Pad Thai", quantity: 1 }],
      platforms: ["ubereats", "doordash", "grubhub"],
      maxCandidatesPerPlatform: 2,
      debug: false,
      platformStartUrls: {
        ubereats: fixtureUrl("fixtures/ubereats/search.html"),
        doordash: fixtureUrl("fixtures/doordash/search.html"),
        grubhub: fixtureUrl("fixtures/grubhub/search.html")
      }
    });

    const quotes = await runAllPlatforms(input);
    expect(quotes).toHaveLength(3);
    expect(quotes.map((quote) => quote.status)).toEqual(["success", "success", "success"]);

    const uberEats = quotes.find((quote) => quote.platform === "ubereats");
    const doorDash = quotes.find((quote) => quote.platform === "doordash");
    const grubhub = quotes.find((quote) => quote.platform === "grubhub");

    expect(uberEats).toMatchObject({
      restaurantName: "Thai Time",
      matchedItemName: "Chicken Pad Thai",
      itemSubtotal: 16.99,
      deliveryFee: 2.99,
      serviceFee: 3.1,
      smallOrderFee: 0,
      tax: 1.82,
      discount: 5,
      finalTotal: 19.9,
      eta: "25-35 min",
      confidence: "high"
    });

    expect(doorDash).toMatchObject({
      finalTotal: 24.18,
      deliveryFee: 1.99,
      serviceFee: 4.2,
      tax: 2,
      eta: "30-40 min"
    });

    expect(grubhub).toMatchObject({
      finalTotal: 26.98,
      deliveryFee: 0.99,
      serviceFee: 3.5,
      promoText: "Promo Save $5.00 on orders over $25",
      eta: "35-45 min"
    });

    const comparison = compareQuotes(quotes);
    expect(comparison.bestPlatform).toBe("doordash");
    expect(comparison.comparisonBasis).toBe("itemSubtotal");
    expect(comparison.savingsVsMostExpensive).toBe(1.5);
    expect(comparison.savingsVsSecondBest).toBe(1);
  }, 120000);
});

function fixtureUrl(path: string): string {
  return pathToFileURL(resolve(path)).toString();
}
