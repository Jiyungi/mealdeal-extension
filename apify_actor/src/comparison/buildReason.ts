import { platformLabel } from "../platforms/basePlatform.js";
import type { QuoteComparison } from "./compareQuotes.js";
import { quoteValue } from "./compareQuotes.js";

export function buildReason(comparison: QuoteComparison): string {
  if (!comparison.bestQuote) {
    return "MealDeal could not choose a platform because no successful platform exposed a visible cart subtotal.";
  }

  const label = platformLabel(comparison.bestQuote.platform);
  const value = formatMoney(quoteValue(comparison.bestQuote, comparison.comparisonBasis));
  const metric =
    comparison.comparisonBasis === "finalTotal" ? "visible final total" : "item subtotal";
  if (comparison.savingsVsSecondBest != null) {
    return `${label} has the lowest ${metric} at ${value}, saving ${formatMoney(
      comparison.savingsVsSecondBest
    )} versus the next cheapest platform.`;
  }

  return `${label} is the only platform with ${metric} of ${value}.`;
}

function formatMoney(value: number | null): string {
  if (value == null) {
    return "not visible";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}
