import { describe, expect, it } from "vitest";
import { extractQuoteBreakdown } from "../src/steps/extractQuoteBreakdown.js";
import type { ActorInput } from "../src/types.js";
import type { PlatformConfig, PlatformQuoteContext } from "../src/platforms/basePlatform.js";

describe("quote breakdown fallback behavior", () => {
  it("uses a menu-price fallback when Uber Eats stays in quick view without a visible cart subtotal", async () => {
    const quote = await extractQuoteBreakdown(
      mockPage(
        "Special instructions\nRequired\nRice Platters\n$13.99\nAdd 1 to order\n$0 delivery fee (new users) Other fees\n27 min",
        "https://www.ubereats.com/store/halal-city-475-6th-st/CiRDe_5mXLSQW3AyVkM1OA?mod=quickView"
      ),
      uberEatsConfig,
      input,
      {
        restaurant: null,
        menuItem: {
          name: "Rice Platters",
          price: 13.99,
          rawText: "Rice Platters $13.99",
          matchScore: 1
        },
        flowWarnings: []
      }
    );

    expect(quote.itemSubtotal).toBe(13.99);
    expect(quote.status).toBe("partial");
    expect(quote.quoteLevel).toBe("menu");
    expect(quote.confidence).toBe("medium");
    expect(quote.warnings.join(" ")).toContain("visible menu price as an item subtotal fallback");
  });
});

const input: ActorInput = {
  address: "2550 Van Ness Avenue, San Francisco, CA",
  restaurantName: "Halal City",
  query: "Rice Platters",
  cartItems: [{ name: "Rice Platters", quantity: 1 }],
  platforms: ["ubereats"],
  maxCandidatesPerPlatform: 3,
  debug: false,
  doorDashUseExternalActors: true
};

const uberEatsConfig: PlatformConfig = {
  platform: "ubereats",
  label: "Uber Eats",
  homepageUrl: "https://www.ubereats.com/",
  searchUrl: (term) => `https://www.ubereats.com/search?q=${encodeURIComponent(term)}`,
  addressInputSelectors: [],
  addressSuggestionSelectors: [],
  addressSubmitSelectors: [],
  searchInputSelectors: [],
  restaurantUrlPatterns: [/\/store\//i],
  menuItemSelectorHints: [],
  cartButtonTexts: [],
  addToCartButtonTexts: [],
  blockedTexts: []
};

function mockPage(bodyText: string, url: string) {
  return {
    url: () => url,
    locator: (_selector: string) => ({
      innerText: async () => bodyText
    })
  } as unknown as Parameters<typeof extractQuoteBreakdown>[0];
}
