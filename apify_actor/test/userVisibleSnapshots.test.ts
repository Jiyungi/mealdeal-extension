import { describe, expect, it } from "vitest";
import { compareQuotes } from "../src/comparison/compareQuotes.js";
import { runAllPlatforms } from "../src/flows/runAllPlatforms.js";
import { validateInput } from "../src/input.js";

describe("user-visible quote snapshots", () => {
  it("uses a supplied platform snapshot without running that platform scraper", async () => {
    const input = validateInput({
      address: "525 Market St, San Francisco, CA",
      query: "Chicken Pad Thai",
      cartItems: [{ name: "Chicken Pad Thai", quantity: 1 }],
      platforms: ["doordash"],
      platformStartUrls: {
        doordash: "https://invalid.localhost.example/"
      },
      userVisibleSnapshots: [
        {
          platform: "doordash",
          status: "success",
          restaurantName: "Thai Time",
          matchedItemName: "Chicken Pad Thai",
          requestedItemName: "Chicken Pad Thai",
          finalTotal: 21.42,
          quoteLevel: "checkout",
          confidence: "high",
          warnings: []
        }
      ]
    });

    const quotes = await runAllPlatforms(input);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      platform: "doordash",
      status: "success",
      finalTotal: 21.42
    });
    expect(quotes[0].warnings).toContain(
      "DoorDash user-visible snapshot supplied; live scraping skipped for this platform."
    );
    expect(compareQuotes(quotes).bestPlatform).toBe("doordash");
  });
});
