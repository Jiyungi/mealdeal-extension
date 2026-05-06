import { describe, expect, it } from "vitest";
import { validateInput } from "../src/input.js";

describe("input validation", () => {
  it("accepts the required Actor input shape", () => {
    const input = validateInput({
      address: "525 Market St, San Francisco, CA",
      query: "Chicken Pad Thai",
      cartItems: [{ name: "Chicken Pad Thai", quantity: 1 }],
      platforms: ["ubereats", "doordash", "grubhub"]
    });

    expect(input.address).toBe("525 Market St, San Francisco, CA");
    expect(input.platforms).toEqual(["ubereats", "doordash", "grubhub"]);
    expect(input.maxCandidatesPerPlatform).toBe(3);
    expect(input.debug).toBe(false);
    expect(input.doorDashUseExternalActors).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(() => validateInput({ query: "sushi" })).toThrow("address");
  });

  it("accepts optional live runtime proxy and browser profile settings", () => {
    const input = validateInput({
      address: "525 Market St, San Francisco, CA",
      query: "Chicken Pad Thai",
      cartItems: [{ name: "Chicken Pad Thai", quantity: 1 }],
      platforms: ["doordash"],
      doorDashStoreUrls: ["https://www.doordash.com/store/thai-time-123"],
      doorDashUseExternalActors: false,
      proxyConfiguration: {
        useApifyProxy: true,
        apifyProxyGroups: ["RESIDENTIAL"],
        apifyProxyCountry: "US"
      },
      platformProxyConfigurations: {
        doordash: {
          useApifyProxy: true,
          groups: ["RESIDENTIAL"],
          countryCode: "US"
        }
      },
      proxyUrl: "http://user:pass@example.com:8000",
      platformProxyUrls: { doordash: "http://user:pass@doordash-proxy.example.com:8000" },
      browserUserDataDir: "/tmp/mealdeal-browser",
      platformBrowserUserDataDirs: { doordash: "/tmp/mealdeal-doordash-browser" }
    });

    expect(input.doorDashStoreUrls).toEqual(["https://www.doordash.com/store/thai-time-123"]);
    expect(input.doorDashUseExternalActors).toBe(false);
    expect(input.proxyConfiguration?.apifyProxyGroups).toEqual(["RESIDENTIAL"]);
    expect(input.platformProxyConfigurations?.doordash?.groups).toEqual(["RESIDENTIAL"]);
    expect(input.proxyUrl).toBe("http://user:pass@example.com:8000");
    expect(input.platformProxyUrls?.doordash).toContain("doordash-proxy");
    expect(input.browserUserDataDir).toBe("/tmp/mealdeal-browser");
    expect(input.platformBrowserUserDataDirs?.doordash).toBe("/tmp/mealdeal-doordash-browser");
  });

  it("normalizes user-visible quote snapshots", () => {
    const input = validateInput({
      address: "525 Market St, San Francisco, CA",
      query: "Chicken Pad Thai",
      cartItems: [{ name: "Chicken Pad Thai", quantity: 1 }],
      platforms: ["doordash"],
      userVisibleSnapshots: [
        {
          platform: "doordash",
          restaurantName: "Thai Time",
          matchedItemName: "Chicken Pad Thai",
          finalTotal: 21.42,
          warnings: ["Captured from visible page."]
        }
      ]
    });

    expect(input.userVisibleSnapshots).toHaveLength(1);
    expect(input.userVisibleSnapshots?.[0]).toMatchObject({
      platform: "doordash",
      status: "success",
      restaurantName: "Thai Time",
      requestedItemName: "Chicken Pad Thai",
      finalTotal: 21.42,
      quoteLevel: "checkout",
      confidence: "high"
    });
  });

  it("defaults user-visible subtotal snapshots to cart-level success", () => {
    const input = validateInput({
      address: "525 Market St, San Francisco, CA",
      query: "Chicken Pad Thai",
      cartItems: [{ name: "Chicken Pad Thai", quantity: 1 }],
      platforms: ["ubereats"],
      userVisibleSnapshots: [
        {
          platform: "ubereats",
          restaurantName: "Thai Time",
          matchedItemName: "Chicken Pad Thai",
          itemSubtotal: 16.99
        }
      ]
    });

    expect(input.userVisibleSnapshots?.[0]).toMatchObject({
      status: "success",
      quoteLevel: "cart",
      confidence: "high"
    });
  });
});
