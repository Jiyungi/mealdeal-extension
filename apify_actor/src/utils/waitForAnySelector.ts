import type { Page } from "playwright";

export async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeoutMs = 5000
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if ((await locator.count().catch(() => 0)) > 0 && (await locator.isVisible().catch(() => false))) {
        return selector;
      }
    }
    await page.waitForTimeout(200);
  }

  return null;
}
