import { Actor, log } from "apify";
import { compareQuotes } from "./comparison/compareQuotes.js";
import { buildReason } from "./comparison/buildReason.js";
import { toMealDealRequest, validateInput } from "./input.js";
import { runAllPlatforms } from "./flows/runAllPlatforms.js";
import { loadLocalEnv } from "./utils/loadLocalEnv.js";
import type { MealDealResult } from "./types.js";

loadLocalEnv();

await Actor.init();

try {
  const input = validateInput(await Actor.getInput());
  log.info("Starting MealDeal quote scrape.", {
    platforms: input.platforms,
    query: input.query,
    restaurantName: input.restaurantName ?? null
  });

  const quotes = await runAllPlatforms(input);
  const comparison = compareQuotes(quotes);
  const warnings = Array.from(
    new Set([
      ...quotes.flatMap((quote) => quote.warnings),
      ...(comparison.bestQuote ? [] : ["No platform returned a comparable item subtotal."])
    ])
  );

  const result: MealDealResult = {
    input: toMealDealRequest(input),
    bestPlatform: comparison.bestPlatform,
    bestQuote: comparison.bestQuote,
    quotes,
    savingsVsMostExpensive: comparison.savingsVsMostExpensive,
    savingsVsSecondBest: comparison.savingsVsSecondBest,
    reason: buildReason(comparison),
    warnings,
    createdAt: new Date().toISOString()
  };

  await Actor.pushData(result);
  log.info("MealDeal quote scrape finished.", {
    bestPlatform: result.bestPlatform,
    quoteCount: result.quotes.length
  });
  await Actor.exit();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown MealDeal Actor failure.";
  log.error("MealDeal Actor failed.", { error: message });
  await Actor.fail(message);
}
