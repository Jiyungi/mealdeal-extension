import type { Page } from "playwright";
import type { PlatformConfig } from "../platforms/basePlatform.js";
import { detectPageState } from "../extractors/detectPageState.js";
import { parseQuoteFieldsFromText } from "../extractors/extractFees.js";
import { safeClickByText, safeClickSelector } from "../utils/safeClick.js";

export async function openCartOrCheckout(
  page: Page,
  config: PlatformConfig
): Promise<string[]> {
  const warnings: string[] = [];
  if (await hasVisibleCartSubtotal(page)) {
    return warnings;
  }

  const opened =
    (await safeClickByText(page, config.cartButtonTexts)) ||
    (config.cartButtonSelectors?.length
      ? await safeClickSelector(page, config.cartButtonSelectors)
      : false);

  if (!opened && !(await hasVisibleCart(page))) {
    warnings.push(`${config.label} cart button was not visible.`);
  }

  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(1500);

  return warnings;
}

async function hasVisibleCart(page: Page): Promise<boolean> {
  const text = await page.locator("body").innerText({ timeout: 2500 }).catch(() => "");
  return detectPageState(text, page.url()).cartVisible;
}

async function hasVisibleCartSubtotal(page: Page): Promise<boolean> {
  const text = await page.locator("body").innerText({ timeout: 2500 }).catch(() => "");
  const state = detectPageState(text, page.url());
  return state.cartVisible && parseQuoteFieldsFromText(text).itemSubtotal != null;
}
