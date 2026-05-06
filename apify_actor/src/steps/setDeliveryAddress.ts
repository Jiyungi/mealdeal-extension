import type { Page } from "playwright";
import type { PlatformConfig } from "../platforms/basePlatform.js";
import { safeClickByText, safeClickSelector } from "../utils/safeClick.js";
import { safeFill } from "../utils/safeFill.js";

export async function setDeliveryAddress(
  page: Page,
  config: PlatformConfig,
  address: string
): Promise<string[]> {
  const warnings: string[] = [];

  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await acceptCookieOrLocationPrompt(page);

  const filled = await safeFill(page, config.addressInputSelectors, address);
  if (!filled) {
    await safeClickByText(page, ["Enter address", "Delivery address", "Deliver to", "Address"]);
    await page.waitForTimeout(500);
  }

  const filledAfterPrompt = filled || (await safeFill(page, config.addressInputSelectors, address));
  if (!filledAfterPrompt) {
    warnings.push(`${config.label} address input was not visible; continuing with platform defaults.`);
    return warnings;
  }

  await page.keyboard.press("Enter").catch(() => undefined);
  await page.waitForTimeout(1000);
  await safeClickSelector(page, config.addressSuggestionSelectors);
  await page.waitForTimeout(750);
  const submitted =
    (await safeClickSelector(page, config.addressSubmitSelectors)) ||
    (await safeClickByText(page, ["Search here", "Search", "Deliver here", "Done"]));
  if (!submitted) {
    warnings.push(`${config.label} address was filled, but no address submit button was confirmed.`);
  }
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(1000);

  return warnings;
}

async function acceptCookieOrLocationPrompt(page: Page): Promise<void> {
  await safeClickByText(page, [
    "Accept",
    "Accept all",
    "I agree",
    "Allow all",
    "Continue",
    "Got it",
    "Maybe later",
    "Not now"
  ]);
}
