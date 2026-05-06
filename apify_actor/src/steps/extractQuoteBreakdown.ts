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
  const preliminaryQuoteLevel = inferQuoteLevel(page.url(), text, state);
  const orderSummaryVisible =
    state.cartVisible ||
    state.checkoutVisible ||
    preliminaryQuoteLevel === "cart" ||
    preliminaryQuoteLevel === "pre_checkout" ||
    preliminaryQuoteLevel === "checkout";
  const hasVisibleSubtotal = fields.itemSubtotal != null && orderSummaryVisible;
  const menuPriceFallback = deriveMenuItemSubtotalFallback(input, context);
  const usedMenuPriceFallback = !hasVisibleSubtotal && menuPriceFallback != null && !state.blocked;
  const finalTotal = fields.finalTotal;
  const requestedItem = input.cartItems[0];
  const itemSubtotal = hasVisibleSubtotal ? fields.itemSubtotal : usedMenuPriceFallback ? menuPriceFallback : null;
  const hasVisibleFees =
    fields.deliveryFee != null ||
    fields.serviceFee != null ||
    fields.smallOrderFee != null ||
    fields.tax != null;

  if (itemSubtotal == null) {
    warnings.push(`${config.label} visible cart subtotal was not available.`);
  } else if (usedMenuPriceFallback) {
    warnings.push(
      `${config.label} visible cart subtotal was not available, so the Actor used the visible menu price as an item subtotal fallback.`
    );
  }
  warnings.push(...pageStateWarnings(config.label, state));
  if (
    textMatchesAny(text, config.blockedTexts) &&
    !state.blocked &&
    !state.loginRequired &&
    !state.cartVisible &&
    !state.checkoutVisible
  ) {
    warnings.push(`${config.label} showed a blocking or login verification page.`);
  }

  const quoteLevel = preliminaryQuoteLevel;
  const status: PlatformQuote["status"] =
    hasVisibleSubtotal || finalTotal != null ? "success" : itemSubtotal != null || hasVisibleFees ? "partial" : "failed";
  const confidence: PlatformQuote["confidence"] =
    hasVisibleSubtotal && (quoteLevel === "cart" || quoteLevel === "pre_checkout" || quoteLevel === "checkout")
      ? "high"
      : itemSubtotal != null || finalTotal != null || hasVisibleFees
        ? "medium"
        : "low";
  const filteredWarnings = filterResolvedWarnings(warnings, {
    label: config.label,
    itemSubtotal,
    orderSummaryVisible,
    hasSelectedRequiredOptionsWarning: warnings.some((warning) =>
      warning.includes("showed required item modifiers, so the Actor selected")
    )
  });

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
    warnings: Array.from(new Set(filteredWarnings)),
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
  if (/\bmod=quickview\b/i.test(url) || /\bmenu-item\b/i.test(url)) {
    return "menu";
  }
  if (state.cartVisible || /\b(cart|bag|basket|your order)\b/.test(combined)) {
    return "cart";
  }
  if (
    state.checkoutVisible ||
    /\b(go to checkout|pre[-\s]?checkout|review order|order summary|estimated total|order total)\b/.test(combined)
  ) {
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

export function deriveMenuItemSubtotalFallback(
  input: ActorInput,
  context: PlatformQuoteContext
): number | null {
  const price = context.menuItem?.price;
  const quantity = input.cartItems[0]?.quantity ?? 1;
  if (price == null) {
    return null;
  }

  return Number((price * quantity).toFixed(2));
}

function filterResolvedWarnings(
  warnings: string[],
  context: {
    label: string;
    itemSubtotal: number | null;
    orderSummaryVisible: boolean;
    hasSelectedRequiredOptionsWarning: boolean;
  }
): string[] {
  return warnings.filter((warning) => {
    if (
      context.itemSubtotal != null &&
      context.orderSummaryVisible &&
      (warning.includes("Could not find a safe add-to-cart button") ||
        warning.includes(`${context.label} cart button was not visible.`))
    ) {
      return false;
    }

    if (
      context.hasSelectedRequiredOptionsWarning &&
      warning === `${context.label} may require item modifiers before the quote is complete.`
    ) {
      return false;
    }

    return true;
  });
}
