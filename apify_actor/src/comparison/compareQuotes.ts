import type { Platform, PlatformQuote } from "../types.js";

export type QuoteComparison = {
  bestPlatform: Platform | null;
  bestQuote: PlatformQuote | null;
  comparisonBasis: "itemSubtotal" | null;
  savingsVsMostExpensive: number | null;
  savingsVsSecondBest: number | null;
  comparableQuotes: PlatformQuote[];
};

export function compareQuotes(quotes: PlatformQuote[]): QuoteComparison {
  const bySubtotal = comparableQuotesBy(quotes, "itemSubtotal");
  const comparisonBasis = bySubtotal.length > 0 ? "itemSubtotal" : null;
  const comparableQuotes = bySubtotal;

  if (comparableQuotes.length === 0) {
    return {
      bestPlatform: null,
      bestQuote: null,
      comparisonBasis: null,
      savingsVsMostExpensive: null,
      savingsVsSecondBest: null,
      comparableQuotes: []
    };
  }

  const bestQuote = comparableQuotes[0];
  const mostExpensive = comparableQuotes[comparableQuotes.length - 1];
  const secondBest = comparableQuotes[1];
  const bestValue = quoteValue(bestQuote, comparisonBasis);
  const mostExpensiveValue = quoteValue(mostExpensive, comparisonBasis);
  const secondBestValue = secondBest ? quoteValue(secondBest, comparisonBasis) : null;

  return {
    bestPlatform: bestQuote.platform,
    bestQuote,
    comparisonBasis,
    savingsVsMostExpensive:
      comparableQuotes.length > 1 && mostExpensiveValue != null && bestValue != null
        ? roundMoney(mostExpensiveValue - bestValue)
        : null,
    savingsVsSecondBest:
      secondBestValue != null && bestValue != null ? roundMoney(secondBestValue - bestValue) : null,
    comparableQuotes
  };
}

function comparableQuotesBy(
  quotes: PlatformQuote[],
  key: "itemSubtotal"
): PlatformQuote[] {
  return quotes
    .filter((quote) => quote.status !== "failed" && typeof quote[key] === "number")
    .sort((left, right) => Number(left[key]) - Number(right[key]));
}

export function quoteValue(
  quote: PlatformQuote,
  basis: QuoteComparison["comparisonBasis"]
): number | null {
  if (!basis) {
    return null;
  }
  return quote[basis];
}

function roundMoney(value: number): number {
  return Number(Math.max(0, value).toFixed(2));
}
