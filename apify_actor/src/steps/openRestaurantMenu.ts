import type { Page } from "playwright";
import type { RestaurantCandidate } from "../platforms/basePlatform.js";
import { safeClickByText } from "../utils/safeClick.js";

export async function openRestaurantMenu(
  page: Page,
  candidate: RestaurantCandidate
): Promise<string[]> {
  const warnings: string[] = [];

  if (candidate.url) {
    await page.goto(candidate.url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    return warnings;
  }

  const clicked = await safeClickByText(page, [candidate.name]);
  if (!clicked) {
    warnings.push(`Could not open matched restaurant "${candidate.name}" from visible search results.`);
  }
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  return warnings;
}
