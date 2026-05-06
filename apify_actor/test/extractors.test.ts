import { describe, expect, it } from "vitest";
import { detectPageState, pageStateWarnings } from "../src/extractors/detectPageState.js";
import { parseQuoteFieldsFromText, textFromHtml } from "../src/extractors/extractFees.js";
import { extractFinalTotalFromText } from "../src/extractors/extractFinalTotal.js";
import { extractDiscountFromText, extractPromoTextFromText } from "../src/extractors/extractPromos.js";

describe("quote extractors", () => {
  it("extracts a visible quote breakdown from static HTML text", () => {
    const text = textFromHtml(`
      <section>
        <div>Subtotal $16.99</div>
        <div>Delivery Fee $2.99</div>
        <div>Service Fee $3.10</div>
        <div>Taxes $1.82</div>
        <div>Promo -$5.00</div>
        <div>Estimated Total $19.90</div>
        <div>25-35 min</div>
      </section>
    `);

    const fields = parseQuoteFieldsFromText(text);
    expect(fields.itemSubtotal).toBe(16.99);
    expect(fields.deliveryFee).toBe(2.99);
    expect(fields.serviceFee).toBe(3.1);
    expect(fields.tax).toBe(1.82);
    expect(fields.discount).toBe(5);
    expect(fields.finalTotal).toBe(19.9);
    expect(fields.eta).toBe("25-35 min");
    expect(extractFinalTotalFromText(text)).toBe(19.9);
    expect(extractPromoTextFromText(text)).toContain("Promo");
  });

  it("does not treat Grubhub fee thresholds as visible quote totals or service fees", () => {
    const text = textFromHtml(`
      <section>
        <div>$0 delivery fee • 15% service fee (max $14)</div>
        <div>No fees when your items total $50+</div>
        <div>Spend $15, Save $5</div>
      </section>
    `);

    const fields = parseQuoteFieldsFromText(text);
    expect(fields.deliveryFee).toBe(0);
    expect(fields.serviceFee).toBeNull();
    expect(fields.finalTotal).toBeNull();
    expect(fields.discount).toBe(5);
    expect(extractFinalTotalFromText(text)).toBeNull();
    expect(extractDiscountFromText(text)).toBe(5);
  });

  it("uses the charged cart subtotal when a discounted subtotal line shows two prices", () => {
    const text = textFromHtml(`
      <section>
        <div>Your order</div>
        <div>Subtotal $43.90 $21.95</div>
        <button>Go to checkout</button>
      </section>
    `);

    const fields = parseQuoteFieldsFromText(text);
    expect(fields.itemSubtotal).toBe(21.95);
    expect(fields.finalTotal).toBeNull();
  });

  it("uses the charged cart subtotal when the subtotal label is on its own line", () => {
    const text = textFromHtml(`
      <section>
        <div>Your order</div>
        <div>Subtotal</div>
        <div>$43.90 $21.95</div>
        <div>Buy 1, get 1 free</div>
      </section>
    `);

    expect(parseQuoteFieldsFromText(text).itemSubtotal).toBe(21.95);
  });


  it("keeps Grubhub menu copy and contact-free FAQ text out of promo text", () => {
    const text = textFromHtml(`
      <section>
        <div>$10 off</div>
        <p>Your choice of protein served on rice and topped off with sauce.</p>
        <p>Q) Does Halal City offer contact-free delivery?</p>
      </section>
    `);

    expect(extractPromoTextFromText(text)).toBe("$10 off");
  });

  it("detects blocked and closed platform page states", () => {
    const blocked = detectPageState("DoorDash Please confirm your reservation. Verifying you are human.");
    expect(blocked.blocked).toBe(true);
    expect(pageStateWarnings("DoorDash", blocked)).toContain(
      "DoorDash showed a blocking or human verification page."
    );

    const cloudflare = detectPageState("www.doordash.com Performing security verification Ray ID 123");
    expect(cloudflare.blocked).toBe(true);

    const closed = detectPageState("This menu isn't available right now. Schedule my order for 6:00am.");
    expect(closed.closedOrPreorder).toBe(true);
    expect(pageStateWarnings("Grubhub", closed)).toContain(
      "Grubhub restaurant or menu is closed, unavailable, or preorder-only."
    );
  });
});
