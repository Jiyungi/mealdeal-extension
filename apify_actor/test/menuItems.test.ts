import { describe, expect, it } from "vitest";
import { extractMenuItems } from "../src/extractors/extractMenuItems.js";
import type { PlatformConfig } from "../src/platforms/basePlatform.js";

describe("menu item extraction", () => {
  it("keeps a clickable item URL when the menu card is linked", async () => {
    const items = await extractMenuItems(
      {
        locator: (selector: string) => ({
          evaluateAll: async () =>
            selector === config.menuItemSelectorHints.join(", ")
              ? [
                  {
                    text: "#1 most liked Rice Platters\n$21.95\nBuy 1, get 1 free",
                    url: "https://www.ubereats.com/store/example?mod=quickView"
                  }
                ]
              : [],
          innerText: async () => ""
        })
      } as never,
      config
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Rice Platters");
    expect(items[0]?.price).toBe(21.95);
    expect(items[0]?.url).toBe("https://www.ubereats.com/store/example?mod=quickView");
  });
});

const config: PlatformConfig = {
  platform: "ubereats",
  label: "Uber Eats",
  homepageUrl: "https://www.ubereats.com/",
  searchUrl: (term) => `https://www.ubereats.com/search?q=${encodeURIComponent(term)}`,
  addressInputSelectors: [],
  addressSuggestionSelectors: [],
  addressSubmitSelectors: [],
  searchInputSelectors: [],
  restaurantUrlPatterns: [/\/store\//i],
  menuItemSelectorHints: ["a", "button"],
  cartButtonTexts: [],
  addToCartButtonTexts: [],
  blockedTexts: []
};
