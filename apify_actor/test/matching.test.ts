import { describe, expect, it } from "vitest";
import { matchItem } from "../src/matching/matchItem.js";
import { matchRestaurant } from "../src/matching/matchRestaurant.js";
import { cleanDisplayText } from "../src/matching/normalizeText.js";
import type { MenuItemCandidate, RestaurantCandidate } from "../src/platforms/basePlatform.js";

describe("matching", () => {
  it("matches equivalent restaurant candidates", () => {
    const candidates: RestaurantCandidate[] = [
      {
        platform: "ubereats",
        name: "Thai Time",
        url: "https://example.com/store/thai-time",
        rawText: "Thai Time 4.7 25-35 min Thai delivery",
        rating: 4.7,
        eta: "25-35 min",
        deliveryAvailable: true,
        score: null
      }
    ];

    expect(matchRestaurant("Thai Time", candidates, "Chicken Pad Thai")?.name).toBe("Thai Time");
  });

  it("matches equivalent menu items", () => {
    const items: MenuItemCandidate[] = [
      {
        name: "Wok-Fired Thai Noodles with Chicken",
        price: 15.99,
        rawText: "Wok-Fired Thai Noodles with Chicken $15.99",
        matchScore: null
      }
    ];

    const match = matchItem("Chicken Pad Thai", items);
    expect(match?.name).toBe("Wok-Fired Thai Noodles with Chicken");
    expect(match?.matchScore).toBeGreaterThan(0.4);
  });

  it("cleans common mojibake from visible platform text", () => {
    expect(cleanDisplayText("McDonald'sÂ®Fast Food â€¢ Affordable Meals")).toBe(
      "McDonald's Fast Food • Affordable Meals"
    );
  });
});
