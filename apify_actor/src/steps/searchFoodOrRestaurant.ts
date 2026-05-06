import type { Page } from "playwright";
import type { PlatformConfig } from "../platforms/basePlatform.js";
import { safeFill } from "../utils/safeFill.js";

export async function searchFoodOrRestaurant(
  page: Page,
  config: PlatformConfig,
  term: string
): Promise<string[]> {
  const warnings: string[] = [];
  const filled = await safeFill(page, config.searchInputSelectors, term);

  if (filled) {
    await page.keyboard.press("Enter").catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
    await page.waitForTimeout(1000);
    return warnings;
  }

  warnings.push(`${config.label} search input was not visible; using search URL fallback.`);
  await page.goto(config.searchUrl(term), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(1000);
  return warnings;
}
