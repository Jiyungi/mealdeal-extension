import type { Page } from "playwright";
import type { PlatformConfig, RestaurantCandidate } from "../platforms/basePlatform.js";
import { cleanDisplayText } from "../matching/normalizeText.js";
import { extractEtaFromText } from "./extractEta.js";

export async function extractRestaurantCandidates(
  page: Page,
  config: PlatformConfig,
  maxCandidates: number
): Promise<RestaurantCandidate[]> {
  const rawCandidates = await page
    .locator("a, [role='link'], [role='button']")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const htmlElement = element as HTMLElement;
        const anchor = element.closest("a") as HTMLAnchorElement | null;
        const text = (htmlElement.innerText || htmlElement.textContent || "").replace(/\s+/g, " ").trim();
        return {
          text,
          href: anchor?.href || (element as HTMLAnchorElement).href || null
        };
      })
    )
    .catch(() => []);

  const seen = new Set<string>();
  const candidates: RestaurantCandidate[] = [];

  for (const raw of rawCandidates) {
    if (!raw.text || raw.text.length < 3 || raw.text.length > 500) {
      continue;
    }

    const cleanedText = cleanDisplayText(raw.text);
    const url = normalizeCandidateUrl(raw.href, config);
    const looksLikeRestaurant =
      url != null || /\b(min|delivery|rating|star|\$|mi|closed|open)\b/i.test(cleanedText);
    if (!looksLikeRestaurant || isNavigationText(cleanedText)) {
      continue;
    }

    const name = extractRestaurantName(cleanedText);
    if (!name || name.length < 2) {
      continue;
    }

    const key = `${name.toLowerCase()}|${url ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    candidates.push({
      platform: config.platform,
      name,
      url,
      rawText: cleanedText,
      rating: extractRating(cleanedText),
      eta: extractEtaFromText(cleanedText),
      deliveryAvailable: !/\b(closed|unavailable|not available|pickup only)\b/i.test(cleanedText),
      score: null
    });
  }

  return candidates.slice(0, Math.max(1, maxCandidates * 4));
}

function normalizeCandidateUrl(href: string | null, config: PlatformConfig): string | null {
  if (!href) {
    return null;
  }
  if (!config.restaurantUrlPatterns.some((pattern) => pattern.test(href))) {
    return null;
  }
  return href;
}

function extractRestaurantName(text: string): string {
  const firstLine = text
    .split(/\s+•\s+/)
    .flatMap((part) => part.split(/(?:\n| {2,}|(?:\d+\s*-\s*\d+\s*min)|(?:\d+\.\d))/i))
    .map((part) => part.trim())
    .find((part) => part && !/^\$/.test(part));

  const name = (firstLine ?? text).replace(/\s+/g, " ").trim();
  return name.replace(/\b([a-z]+)\b\s+\1$/i, "$1").trim();
}

function extractRating(text: string): number | null {
  const match = text.match(/\b([1-5]\.\d)\b/);
  if (!match) {
    return null;
  }
  const rating = Number(match[1]);
  return Number.isFinite(rating) ? rating : null;
}

function isNavigationText(text: string): boolean {
  return /\b(sign in|log in|help|privacy|terms|cart|checkout|account|gift card)\b/i.test(text);
}
