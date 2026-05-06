import { parseMoney, parseMoneyValues } from "../utils/parseMoney.js";

export function extractPromoTextFromText(text: string): string | null {
  const promoLines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => {
      const hasMoney = /\$\s*\d/.test(line);
      if (/\bcontact[-\s]?free\b/i.test(line)) {
        return false;
      }
      if (/^(?:q\)|how do i get|how can i order|does .+ offer delivery|what is the .+ address)/i.test(line)) {
        return false;
      }
      if (/\?$/.test(line)) {
        return false;
      }

      return (
        /\b(save|promo|promotion|discount|coupon|offer valid|qualifying orders?|promo code)\b/i.test(line) ||
        (hasMoney && /\boff\b/i.test(line)) ||
        /\b(no fees|free delivery|buy one)\b/i.test(line)
      );
    });

  return promoLines.length ? Array.from(new Set(promoLines)).slice(0, 4).join("; ") : null;
}

export function extractDiscountFromText(text: string): number | null {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/\b(discount|promo|promotion|coupon|credit|save)\b/i.test(line)) {
      const money = extractSavingsMoney(line);
      if (money != null) {
        return Math.abs(money);
      }
    }
  }

  return null;
}

function extractSavingsMoney(line: string): number | null {
  const explicitSave = line.match(/\b(?:save|discount|promo|promotion|coupon|credit)\b[^\n$-]*(-?\$\s*\d+(?:\.\d{2})?)/i);
  if (explicitSave?.[1]) {
    return parseMoney(explicitSave[1]);
  }

  const values = parseMoneyValues(line);
  if (values.length === 0) {
    return null;
  }

  if (/\b(spend|orders?\s+over|minimum|items?\s+total)\b/i.test(line) && values.length > 1) {
    return values[values.length - 1];
  }

  return values[0];
}
