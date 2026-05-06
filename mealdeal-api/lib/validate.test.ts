import { describe, expect, it } from "vitest";
import { validateMealDealRequest } from "./validate";

const base = {
  address: "525 Market St, San Francisco, CA",
  query: "Chicken Pad Thai",
  cartItems: [{ name: "Chicken Pad Thai", quantity: 1 }],
  platforms: ["ubereats", "doordash", "grubhub"],
};

describe("validateMealDealRequest", () => {
  it("accepts a well-formed request and defaults Actor options", () => {
    const res = validateMealDealRequest(base);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.input.address).toBe(base.address);
    expect(res.input.cartItems[0]).toEqual({
      name: "Chicken Pad Thai",
      quantity: 1,
    });
    expect(res.input.platforms).toEqual(base.platforms);
    expect(res.input.maxCandidatesPerPlatform).toBe(3);
    expect(res.input.debug).toBe(false);
  });

  it("rejects a missing address", () => {
    const res = validateMealDealRequest({ ...base, address: "   " });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/address/);
  });

  it("rejects a missing query", () => {
    const res = validateMealDealRequest({ ...base, query: "" });
    expect(res.ok).toBe(false);
  });

  it("rejects empty cartItems", () => {
    const res = validateMealDealRequest({ ...base, cartItems: [] });
    expect(res.ok).toBe(false);
  });

  it("rejects a cart item without a name", () => {
    const res = validateMealDealRequest({
      ...base,
      cartItems: [{ name: "", quantity: 1 }],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/cartItems\[0\]\.name/);
  });

  it("coerces invalid quantity values to 1", () => {
    const res = validateMealDealRequest({
      ...base,
      cartItems: [{ name: "Pad Thai", quantity: -3 }],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.input.cartItems[0].quantity).toBe(1);
  });

  it("rejects an unknown platform", () => {
    const res = validateMealDealRequest({
      ...base,
      platforms: ["ubereats", "postmates"],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/postmates/);
  });

  it("rejects empty platforms", () => {
    const res = validateMealDealRequest({ ...base, platforms: [] });
    expect(res.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(validateMealDealRequest(null).ok).toBe(false);
    expect(validateMealDealRequest("oops").ok).toBe(false);
  });
});
