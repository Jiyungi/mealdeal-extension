import { Actor } from "apify";
import type { Page } from "playwright";
import type { ActorInput, Platform } from "../types.js";

export async function screenshotDebug(
  page: Page,
  input: ActorInput,
  platform: Platform,
  stage: string
): Promise<void> {
  if (!input.debug) {
    return;
  }

  const key = `debug-${platform}-${stage}-${Date.now()}`;
  const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
  if (screenshot) {
    await Actor.setValue(key, screenshot, { contentType: "image/png" });
  }
}
