import { describe, expect, it } from "vitest";
import { parseMoney, parseMoneyValues } from "../src/utils/parseMoney.js";

describe("money parsing", () => {
  it("parses visible money values", () => {
    expect(parseMoney("Final total $23.08")).toBe(23.08);
    expect(parseMoney("$1,234.56")).toBe(1234.56);
  });

  it("keeps discount signs when visible", () => {
    expect(parseMoney("-$5.00 promo")).toBe(-5);
  });

  it("returns null when no money is visible", () => {
    expect(parseMoney("free delivery")).toBeNull();
  });

  it("parses all visible money values", () => {
    expect(parseMoneyValues("Subtotal $16.99 fee $2.99")).toEqual([16.99, 2.99]);
  });
});
