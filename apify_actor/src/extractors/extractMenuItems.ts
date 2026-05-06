import type { Page } from "playwright";
import type { MenuItemCandidate, PlatformConfig } from "../platforms/basePlatform.js";
import { parseMoney } from "../utils/parseMoney.js";

export async function extractMenuItems(
  page: Page,
  config: PlatformConfig
): Promise<MenuItemCandidate[]> {
  const selector = config.menuItemSelectorHints.join(", ");
  const rawItems = await page
    .locator(selector)
    .evaluateAll((elements) =>
      elements.map((element) => {
        const htmlElement = element as HTMLElement;
        const accessibleName =
          htmlElement.getAttribute("aria-label") || htmlElement.getAttribute("title") || "";
        const visibleText = (htmlElement.innerText || htmlElement.textContent || "").trim();
        return [accessibleName.trim(), visibleText].filter(Boolean).join("\n");
      })
    )
    .catch(() => []);

  const bodyFallback = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const candidates = [...rawItems, ...splitPossibleMenuRows(bodyFallback)];
  const seen = new Set<string>();
  const menuItems: MenuItemCandidate[] = [];

  for (const rawText of candidates) {
    if (!rawText || rawText.length < 3 || rawText.length > 600) {
      continue;
    }
    const price = parseMoney(rawText);
    if (price == null || isNonItemText(rawText)) {
      continue;
    }

    const name = extractItemName(rawText);
    if (!name || name.length < 2) {
      continue;
    }

    const key = `${name.toLowerCase()}|${price}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    menuItems.push({
      name,
      price,
      rawText,
      matchScore: null
    });
  }

  return menuItems;
}

function splitPossibleMenuRows(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/\$\s*\d/.test(line)) {
      rows.push([lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" "));
    }
  }

  return rows;
}

function extractItemName(text: string): string {
  const firstLine = text
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => isLikelyItemNameLine(line));
  if (firstLine) {
    return firstLine.replace(/\s+/g, " ").trim();
  }

  const beforePrice = text.split(/\$\s*\d/)[0]?.trim() ?? text;
  const firstSentence = beforePrice
    .split(/(?:\d+\s*cal|\bpopular\b|\bcontains\b|\bwith\b.*\$)/i)[0]
    ?.trim();
  return (firstSentence || beforePrice).replace(/\s+/g, " ").trim();
}

function isNonItemText(text: string): boolean {
  return /\b(subtotal|delivery fee|service fee|tax|total|checkout|cart|tip|discount|promo)\b/i.test(text);
}

function isLikelyItemNameLine(line: string): boolean {
  if (!line || /\$\s*\d/.test(line)) {
    return false;
  }
  if (/^#\d+\s+most\s+liked\b/i.test(line)) {
    return false;
  }
  if (/^(popular|buy\s+\d|spend\s+\$|save\s+\$|\d+%\s+off)\b/i.test(line)) {
    return false;
  }
  if (/^\d+(?:\.\d+)?\s*(?:mi|min|ratings?|reviews?)\b/i.test(line)) {
    return false;
  }
  return /[a-z]/i.test(line);
}
