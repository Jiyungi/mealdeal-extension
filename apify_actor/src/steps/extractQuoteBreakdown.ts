import type { Page } from "playwright";
import type { ActorInput, PlatformQuote } from "../types.js";
import type { PlatformConfig, PlatformQuoteContext } from "../platforms/basePlatform.js";
import { detectPageState, pageStateWarnings, type VisiblePageState } from "../extractors/detectPageState.js";
import { extractEtaFromText } from "../extractors/extractEta.js";
import { parseQuoteFieldsFromText } from "../extractors/extractFees.js";
import { extractPromoTextFromText } from "../extractors/extractPromos.js";

export async function extractQuoteBreakdown(
  page: Page,
  config: PlatformConfig,
  input: ActorInput,
  context: PlatformQuoteContext
): Promise<PlatformQuote> {
  const warnings = [...context.flowWarnings];
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const state = detectPageState(text, page.url());
  const fields = parseQuoteFieldsFromText(text);
  const finalTotal = fields.finalTotal;
  const requestedItem = input.cartItems[0];
  const itemSubtotal = fields.itemSubtotal;
  const hasVisibleFees =
    fields.deliveryFee != null ||
    fields.serviceFee != null ||
    fields.smallOrderFee != null ||
    fields.tax != null;

  if (itemSubtotal == null) {
    warnings.push(`${config.label} visible cart subtotal was not available.`);
  }
  warnings.push(...pageStateWarnings(config.label, state));
  if (
    textMatchesAny(text, config.blockedTexts) &&
    !state.blocked &&
    !state.loginRequired &&
    !state.cartVisible
  ) {
    warnings.push(`${config.label} showed a blocking or login verification page.`);
  }

  const quoteLevel = inferQuoteLevel(page.url(), text, state);
  const status: PlatformQuote["status"] =
    itemSubtotal != null || finalTotal != null ? "success" : hasVisibleFees ? "partial" : "failed";
  const confidence: PlatformQuote["confidence"] =
    itemSubtotal != null && quoteLevel === "cart"
      ? "high"
      : itemSubtotal != null || finalTotal != null || hasVisibleFees
        ? "medium"
        : "low";

  return {
    platform: config.platform,
    status,
    restaurantName: context.restaurant?.name ?? null,
    restaurantUrl: context.restaurant?.url ?? null,
    matchedItemName: context.menuItem?.name ?? null,
    requestedItemName: requestedItem.name,
    matchScore: context.menuItem?.matchScore ?? null,
    itemSubtotal,
    deliveryFee: fields.deliveryFee,
    serviceFee: fields.serviceFee,
    smallOrderFee: fields.smallOrderFee,
    tax: fields.tax,
    discount: fields.discount,
    finalTotal,
    promoText: extractPromoTextFromText(text),
    eta: fields.eta ?? extractEtaFromText(text) ?? context.restaurant?.eta ?? null,
    checkoutUrl: page.url(),
    quoteLevel,
    confidence,
    warnings: Array.from(new Set(warnings)),
    rawEvidence: fields.rawEvidence
  };
}

function inferQuoteLevel(
  url: string,
  text: string,
  state: VisiblePageState
): PlatformQuote["quoteLevel"] {
  if ((state.blocked || state.loginRequired) && !state.cartVisible && !state.checkoutVisible) {
    return "unknown";
  }

  const combined = `${url}\n${text}`.toLowerCase();
  if (
    /\/checkout\b/i.test(url) ||
    /\b(payment method|payment option|add payment|pay with|place order|due today)\b/.test(
      combined
    )
  ) {
    return "checkout";
  }
  if (state.cartVisible || /\b(cart|bag|basket|your order)\b/.test(combined)) {
    return "cart";
  }
  if (/\b(pre[-\s]?checkout|review order|order summary|estimated total|order total)\b/.test(combined)) {
    return "pre_checkout";
  }
  if (/\bmenu\b/.test(combined)) {
    return "menu";
  }
  return "unknown";
}

function textMatchesAny(text: string, patterns: string[]): boolean {
  const normalized = text.toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern.toLowerCase()));
}
