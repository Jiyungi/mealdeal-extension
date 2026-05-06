import type { Page } from "playwright";
import type { Locator } from "playwright";
import type { ClickTarget } from "../platforms/basePlatform.js";
import { waitForAnySelector } from "./waitForAnySelector.js";

const UNSAFE_ACTION_TEXT = /\b(place order|submit order|pay now|purchase|confirm payment|complete order)\b/i;

export async function safeClickSelector(
  page: Page,
  selectors: string[],
  timeoutMs = 3500
): Promise<boolean> {
  const selector = await waitForAnySelector(page, selectors, timeoutMs);
  if (!selector) {
    return false;
  }

  const locator = page.locator(selector).first();
  const text = await locator.innerText({ timeout: 1000 }).catch(() => "");
  if (isUnsafeActionText(text)) {
    return false;
  }

  return locator.click({ timeout: timeoutMs }).then(
    () => true,
    () => false
  );
}

export async function safeClickByText(
  page: Page,
  texts: ClickTarget[],
  timeoutMs = 3500
): Promise<boolean> {
  for (const text of texts) {
    if (typeof text === "string" && isUnsafeActionText(text)) {
      continue;
    }

    const locators = [
      page.getByRole("button", { name: text, exact: typeof text === "string" ? false : undefined }).first(),
      page.getByRole("link", { name: text, exact: typeof text === "string" ? false : undefined }).first(),
      page.getByText(text, { exact: false }).first()
    ];

    for (const locator of locators) {
      if (await clickSafeLocator(locator, text, timeoutMs)) {
        return true;
      }
    }
  }

  return false;
}

export function isUnsafeActionText(text: string): boolean {
  return UNSAFE_ACTION_TEXT.test(text);
}

async function clickSafeLocator(
  locator: Locator,
  target: ClickTarget,
  timeoutMs: number
): Promise<boolean> {
  if ((await locator.count().catch(() => 0)) === 0) {
    return false;
  }
  if (!(await locator.isVisible({ timeout: 750 }).catch(() => false))) {
    return false;
  }
  if (!(await locator.isEnabled({ timeout: 750 }).catch(() => true))) {
    return false;
  }

  const visibleText = await locator
    .innerText({ timeout: 1000 })
    .catch(() => (typeof target === "string" ? target : ""));
  if (isUnsafeActionText(visibleText)) {
    return false;
  }

  return locator.click({ timeout: timeoutMs }).then(
    () => true,
    () => false
  );
}
