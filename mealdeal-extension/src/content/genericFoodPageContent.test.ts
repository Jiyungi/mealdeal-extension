import { describe, expect, it } from "vitest";
import { buildSnapshot, extractVisibleMoney } from "./genericFoodPageContent";

describe("extractVisibleMoney", () => {
  it("parses a plain dollar amount", () => {
    expect(extractVisibleMoney("$16.99")).toBe(16.99);
  });

  it("parses negative amounts (discounts)", () => {
    expect(extractVisibleMoney("-$5.00")).toBe(-5);
  });

  it("ignores surrounding label text", () => {
    expect(extractVisibleMoney("Delivery Fee $2.99")).toBe(2.99);
  });

  it("returns null when no money pattern is found", () => {
    expect(extractVisibleMoney("Free delivery")).toBeNull();
    expect(extractVisibleMoney(null)).toBeNull();
    expect(extractVisibleMoney(undefined)).toBeNull();
  });
});

describe("buildSnapshot", () => {
  it("marks a quote with a finalTotal as success with medium confidence", () => {
    const snap = buildSnapshot("ubereats", {
      restaurantName: "Thai Time",
      matchedItemName: "Chicken Pad Thai",
      itemSubtotal: 16.99,
      finalTotal: 19.9,
    });
    expect(snap.platform).toBe("ubereats");
    expect(snap.status).toBe("success");
    expect(snap.confidence).toBe("medium");
    expect(snap.restaurantName).toBe("Thai Time");
  });

  it("marks a quote without any money as partial/low", () => {
    const snap = buildSnapshot("doordash", {
      restaurantName: "Thai Time",
    });
    expect(snap.status).toBe("partial");
    expect(snap.confidence).toBe("low");
  });
});
