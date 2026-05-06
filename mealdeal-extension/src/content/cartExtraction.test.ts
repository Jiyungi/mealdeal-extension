import { beforeEach, describe, expect, it } from "vitest";
import {
  collectCartRows,
  extractQuantityFromText,
  toCartItems,
} from "./genericFoodPageContent";

describe("extractQuantityFromText", () => {
  it("parses `2x Chicken Pad Thai`", () => {
    expect(extractQuantityFromText("2x Chicken Pad Thai")).toBe(2);
  });
  it("parses `Qty 3`", () => {
    expect(extractQuantityFromText("Qty 3")).toBe(3);
  });
  it("parses unicode `3× Burger`", () => {
    expect(extractQuantityFromText("3× Burger")).toBe(3);
  });
  it("returns null when no quantity is present", () => {
    expect(extractQuantityFromText("Chicken Pad Thai")).toBeNull();
    expect(extractQuantityFromText(null)).toBeNull();
  });
});

describe("collectCartRows + toCartItems", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <ul>
        <li data-testid="cart-item">
          <h4>Chicken Pad Thai</h4>
          <span>2x</span>
          <span>$33.98</span>
        </li>
        <li data-testid="cart-item">
          <h4>Thai Iced Tea</h4>
          <input type="number" value="1" />
          <span>$4.50</span>
        </li>
        <li data-testid="cart-item">
          <h4>Chicken Pad Thai</h4>
          <span>Qty 1</span>
          <span>$16.99</span>
        </li>
      </ul>
    `;
  });

  it("collects rows with name, quantity, and price", () => {
    const rows = collectCartRows(['[data-testid="cart-item"]']);
    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe("Chicken Pad Thai");
    expect(rows[0].quantity).toBe(2);
    expect(rows[0].price).toContain("$33.98");
    expect(rows[1].name).toBe("Thai Iced Tea");
    expect(rows[1].quantity).toBe(1);
  });

  it("merges duplicate items when converting to CartItemRequest", () => {
    const rows = collectCartRows(['[data-testid="cart-item"]']);
    const items = toCartItems(rows);
    expect(items).toHaveLength(2);
    const padThai = items.find((i) => i.name === "Chicken Pad Thai");
    expect(padThai?.quantity).toBe(3); // 2 + 1
  });

  it("returns an empty array when no rows match", () => {
    document.body.innerHTML = "<div>nothing here</div>";
    expect(collectCartRows(['[data-testid="cart-item"]'])).toEqual([]);
    expect(toCartItems([])).toEqual([]);
  });
});
