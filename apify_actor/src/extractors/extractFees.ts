import { extractEtaFromText } from "./extractEta.js";
import { extractDiscountFromText } from "./extractPromos.js";
import { parseMoney, parseMoneyValues } from "../utils/parseMoney.js";

export type QuoteFields = {
  itemSubtotal: number | null;
  deliveryFee: number | null;
  serviceFee: number | null;
  smallOrderFee: number | null;
  tax: number | null;
  discount: number | null;
  finalTotal: number | null;
  eta: string | null;
  rawEvidence: Record<string, string | null>;
};

export function parseQuoteFieldsFromText(text: string): QuoteFields {
  const lines = visibleLines(text);
  const subtotal = findMoneyForLabels(lines, ["subtotal", "item subtotal", "items subtotal"], ["tax"]);
  const deliveryFee = findMoneyForLabels(lines, ["delivery fee"], ["free delivery", "no fees"]);
  const serviceFee = findMoneyForLabels(lines, ["service fee", "service fees"], ["delivery"]);
  const smallOrderFee = findMoneyForLabels(lines, ["small order fee", "small order"], []);
  const tax = findMoneyForLabels(lines, ["tax", "taxes", "estimated tax"], ["taxi"]);
  const discount = extractDiscountFromText(text);
  const finalTotal = findFinalTotal(lines);
  const eta = extractEtaFromText(text);

  return {
    itemSubtotal: subtotal.value,
    deliveryFee: deliveryFee.value,
    serviceFee: serviceFee.value,
    smallOrderFee: smallOrderFee.value,
    tax: tax.value,
    discount,
    finalTotal: finalTotal.value,
    eta,
    rawEvidence: {
      subtotalText: subtotal.raw,
      deliveryFeeText: deliveryFee.raw,
      serviceFeeText: serviceFee.raw,
      smallOrderFeeText: smallOrderFee.raw,
      taxText: tax.raw,
      discountText: discount == null ? null : findRawLine(lines, ["discount", "promo", "save"]),
      finalTotalText: finalTotal.raw,
      etaText: eta
    }
  };
}

export function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function visibleLines(text: string): string[] {
  return text
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findMoneyForLabels(
  lines: string[],
  labels: string[],
  exclusions: string[]
): { value: number | null; raw: string | null } {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lower = line.toLowerCase();
    if (!labels.some((label) => lower.includes(label))) {
      continue;
    }
    if (exclusions.some((exclusion) => lower.includes(exclusion))) {
      continue;
    }

    if (
      isPromotionalThresholdText(line) ||
      hasThresholdMoney(line) ||
      isFeeDisclosureWithoutVisibleAmount(line, labels)
    ) {
      continue;
    }

    const money = chooseLabeledMoney(line, labels);
    if (money != null) {
      return { value: money, raw: line };
    }

    const nearby = [line, lines[index + 1], lines[index - 1]].filter(Boolean).join(" ");
    const nearbyMoney = chooseLabeledMoney(nearby, labels) ?? parseMoney(nearby);
    if (nearbyMoney != null) {
      return { value: nearbyMoney, raw: nearby };
    }
  }

  return { value: null, raw: null };
}

function chooseLabeledMoney(line: string, labels: string[]): number | null {
  const values = parseMoneyValues(labeledSegment(line, labels));
  if (values.length === 0) {
    return null;
  }

  return labels.some((label) => label.includes("subtotal")) ? values[values.length - 1] : values[0];
}

function labeledSegment(line: string, labels: string[]): string {
  const lower = line.toLowerCase();
  const labelMatch = labels
    .map((label) => ({ label, index: lower.indexOf(label) }))
    .filter((match) => match.index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  if (!labelMatch) {
    return line;
  }

  const segmentStart = labelMatch.index;
  const searchStart = segmentStart + labelMatch.label.length;
  const followingLabels = [
    "delivery fee",
    "service fee",
    "small order fee",
    "estimated tax",
    "taxes",
    "tax",
    "estimated total",
    "order total",
    "total"
  ];
  const segmentEnd = followingLabels
    .map((label) => lower.indexOf(label, searchStart))
    .filter((index) => index > segmentStart)
    .sort((left, right) => left - right)[0];

  return line.slice(segmentStart, segmentEnd ?? undefined);
}

function findFinalTotal(lines: string[]): { value: number | null; raw: string | null } {
  const labels = ["estimated total", "order total", "total", "due today"];
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const lower = line.toLowerCase();
    if (!labels.some((label) => lower.includes(label))) {
      continue;
    }
    if (/\b(subtotal|tax total|fees total)\b/i.test(line)) {
      continue;
    }

    if (!isExplicitTotalLine(line) || isPromotionalThresholdText(line) || hasThresholdMoney(line)) {
      continue;
    }

    const nearby = [line, lines[index + 1], lines[index - 1]].filter(Boolean).join(" ");
    const money = parseMoney(nearby);
    if (money != null) {
      return { value: money, raw: nearby };
    }
  }

  return { value: null, raw: null };
}

function findRawLine(lines: string[], labels: string[]): string | null {
  return lines.find((line) => labels.some((label) => line.toLowerCase().includes(label))) ?? null;
}

function isExplicitTotalLine(line: string): boolean {
  return /\b(estimated total|order total|total|due today)\b/i.test(line);
}

function isPromotionalThresholdText(text: string): boolean {
  return /\b(orders?\s+over|items?\s+total|when\s+your\s+items?\s+total|spend|save|promo|promotion|coupon|discount|off|no fees|free delivery)\b/i.test(
    text
  );
}

function hasThresholdMoney(text: string): boolean {
  return /\$\s*\d+(?:\.\d{2})?\s*\+/.test(text);
}

function isFeeDisclosureWithoutVisibleAmount(text: string, labels: string[]): boolean {
  if (!labels.some((label) => label.includes("service"))) {
    return false;
  }
  return /\b(service fee|service fees)\b/i.test(text) && /\b(max|up to|\d+\s*%)\b/i.test(text);
}
