import { describe, expect, it } from "vitest";
import { formatPercent, formatSavings, formatUSD } from "./formatMoney";

describe("formatUSD", () => {
  it("formats whole numbers with two decimals", () => {
    expect(formatUSD(5)).toBe("$5.00");
  });

  it("formats fractional values", () => {
    expect(formatUSD(19.9)).toBe("$19.90");
  });

  it("returns em dash for null, undefined, and NaN", () => {
    expect(formatUSD(null)).toBe("—");
    expect(formatUSD(undefined)).toBe("—");
    expect(formatUSD(Number.NaN)).toBe("—");
  });
});

describe("formatSavings", () => {
  it("returns empty string when there are no savings", () => {
    expect(formatSavings(null)).toBe("");
    expect(formatSavings(0)).toBe("");
    expect(formatSavings(-1)).toBe("");
  });

  it("formats positive savings vs most expensive", () => {
    expect(formatSavings(3.42)).toBe("Save $3.42 vs most expensive");
  });
});

describe("formatPercent", () => {
  it("rounds to the nearest whole percent", () => {
    expect(formatPercent(0.9412)).toBe("94%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("returns em dash for null", () => {
    expect(formatPercent(null)).toBe("—");
  });
});
