import type { Page } from "playwright";
import { waitForAnySelector } from "./waitForAnySelector.js";

export async function safeFill(
  page: Page,
  selectors: string[],
  value: string,
  timeoutMs = 5000
): Promise<boolean> {
  const selector = await waitForAnySelector(page, selectors, timeoutMs);
  if (!selector) {
    return false;
  }

  const locator = page.locator(selector).first();
  await locator.click({ timeout: timeoutMs }).catch(() => undefined);
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => undefined);
  await locator.press("Backspace").catch(() => undefined);

  const typed = await locator.pressSequentially(value, { timeout: timeoutMs, delay: 20 }).then(
    () => true,
    () => false
  );
  if (typed) {
    return true;
  }

  return locator.fill(value, { timeout: timeoutMs }).then(
    () => true,
    () => false
  );
}
