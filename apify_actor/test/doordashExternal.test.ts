import { describe, expect, it } from "vitest";
import {
  normalizeDoorDashExternalQuote,
  resolveDoorDashStoreUrls,
  subtotalFromDoorDashPrice
} from "../src/platforms/doorDashExternal.js";
import type { ActorInput } from "../src/types.js";

describe("DoorDash external actor normalization", () => {
  it("normalizes CrawlerBros menu data into a DoorDash menu subtotal quote", () => {
    const quote = normalizeDoorDashExternalQuote(
      input({ quantity: 2 }),
      [
        {
          storeName: "Halal City",
          storeUrl: "https://www.doordash.com/store/halal-city---soma-san-francisco-34620533",
          title: "Order Halal City - San Francisco, CA Menu Delivery [Menu & Prices] | San Francisco - DoorDash",
          description: "Get delivery or takeout from Halal City at 60 Morris St in San Francisco.",
          address: "60 Morris St",
          menuItems: [
            {
              section: "Most Ordered",
              name: "Rice Platters",
              description: "Choice of protein over seasoned rice.",
              price: "2 for $21.95"
            },
            {
              section: "Most Ordered",
              name: "Chicken Over Rice",
              price: "$13.99"
            }
          ]
        }
      ],
      "crawlerbros/doordash-restaurant-scraper",
      "CrawlerBros DoorDash Restaurant Scraper"
    );

    expect(quote).toMatchObject({
      platform: "doordash",
      status: "success",
      restaurantName: "Halal City",
      restaurantUrl: "https://www.doordash.com/store/halal-city---soma-san-francisco-34620533",
      matchedItemName: "Rice Platters",
      requestedItemName: "Rice Platters",
      itemSubtotal: 21.95,
      finalTotal: null,
      quoteLevel: "menu",
      confidence: "medium"
    });
    expect(quote.warnings.join(" ")).toContain("external Apify Actor");
  });

  it("prefers DoorDash display bundle pricing over numeric fallback fields", () => {
    const quote = normalizeDoorDashExternalQuote(input({ quantity: 2 }), [
      {
        name: "Rice Platters",
        description: "Choice of protein over rice.",
        category: "Most Ordered",
        price: 2,
        price_display: "2 for $21.95",
        is_available: true
      }
    ]);

    expect(quote.status).toBe("success");
    expect(quote.matchedItemName).toBe("Rice Platters");
    expect(quote.itemSubtotal).toBe(21.95);
    expect(quote.restaurantName).toBeNull();
  });

  it("handles bundle and normal DoorDash menu prices conservatively", () => {
    expect(subtotalFromDoorDashPrice("2 for $21.95", 2)).toBe(21.95);
    expect(subtotalFromDoorDashPrice("2 for $21.95", 3)).toBe(43.9);
    expect(subtotalFromDoorDashPrice("$13.99", 2)).toBe(27.98);
  });

  it("returns a partial quote when DoorDash menu data has no matching item", () => {
    const quote = normalizeDoorDashExternalQuote(input(), [
      {
        storeName: "Halal City",
        storeUrl: "https://www.doordash.com/store/halal-city---soma-san-francisco-34620533",
        menuItems: [{ section: "Drinks", name: "Mango Lassi", price: "$4.99" }]
      }
    ]);

    expect(quote.status).toBe("partial");
    expect(quote.itemSubtotal).toBeNull();
    expect(quote.restaurantName).toBe("Halal City");
    expect(quote.warnings.join(" ")).toContain("no menu item matched");
  });

  it("resolves DoorDash direct store URLs from dedicated and platform start URL inputs", () => {
    expect(
      resolveDoorDashStoreUrls({
        ...input(),
        doorDashStoreUrls: ["https://www.doordash.com/store/a-123"],
        platformStartUrls: { doordash: "https://www.doordash.com/store/b-456" }
      })
    ).toEqual(["https://www.doordash.com/store/a-123", "https://www.doordash.com/store/b-456"]);
  });
});

function input({ quantity = 1 }: { quantity?: number } = {}): ActorInput {
  return {
    address: "2550 Van Ness Avenue, San Francisco, CA",
    restaurantName: "Halal City",
    query: "Rice Platters",
    cartItems: [{ name: "Rice Platters", quantity }],
    platforms: ["doordash"],
    maxCandidatesPerPlatform: 3,
    debug: false,
    doorDashUseExternalActors: true
  };
}
