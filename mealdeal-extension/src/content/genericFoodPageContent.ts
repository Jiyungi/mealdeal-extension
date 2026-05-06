import type {
  CartItemRequest,
  PageContext,
  Platform,
  PlatformQuote,
} from "../lib/types";
import { cleanAddress, cleanItemName } from "../lib/cleanText";

export function detectPlatform(): Platform | null {
  const host = location.hostname;
  if (host.includes("ubereats.com")) return "ubereats";
  if (host.includes("doordash.com")) return "doordash";
  if (host.includes("grubhub.com")) return "grubhub";
  return null;
}

const MONEY_RE = /-?\$\s?\d+(?:\.\d{1,2})?/;
const MONEY_RE_G = /-?\$\s?\d+(?:\.\d{1,2})?/g;

export function extractVisibleMoney(
  text: string | null | undefined,
): number | null {
  if (!text) return null;
  const match = text.match(MONEY_RE);
  if (!match) return null;
  const n = Number(match[0].replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Pick the last visible money amount in a label block. Real platform
 * totals with a promo render as "Total $45.00 $38.00" (original +
 * discounted, sometimes with a strikethrough). The final, user-facing
 * total is the last amount, not the first.
 */
export function extractFinalMoney(
  text: string | null | undefined,
): number | null {
  if (!text) return null;
  const matches = text.match(MONEY_RE_G);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const n = Number(last.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function firstMatch(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

export function allMatches(selectors: string[]): HTMLElement[] {
  for (const selector of selectors) {
    const list = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    );
    if (list.length > 0) return list;
  }
  return [];
}

export function textOf(el: Element | null | undefined): string | null {
  const t = el?.textContent?.trim();
  return t && t.length > 0 ? t : null;
}

export function findByLabel(labelPatterns: RegExp[]): HTMLElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("li, tr, div, p, span"),
  );
  for (const node of nodes) {
    const text = node.textContent ?? "";
    if (labelPatterns.some((re) => re.test(text))) {
      return node;
    }
  }
  return null;
}

export function emptySnapshot(platform: Platform): PlatformQuote {
  return {
    platform,
    status: "partial",
    restaurantName: null,
    restaurantUrl: null,
    matchedItemName: null,
    requestedItemName: null,
    matchScore: null,
    itemSubtotal: null,
    deliveryFee: null,
    serviceFee: null,
    smallOrderFee: null,
    tax: null,
    discount: null,
    finalTotal: null,
    promoText: null,
    eta: null,
    checkoutUrl: location.href,
    quoteLevel: "unknown",
    confidence: "low",
    warnings: [],
    rawEvidence: {},
  };
}

export type SnapshotParts = Partial<Omit<PlatformQuote, "platform">>;

export function buildSnapshot(
  platform: Platform,
  parts: SnapshotParts,
): PlatformQuote {
  const base = emptySnapshot(platform);
  const merged: PlatformQuote = { ...base, ...parts };
  const hasAnyMoney =
    merged.itemSubtotal !== null ||
    merged.finalTotal !== null ||
    merged.deliveryFee !== null;
  merged.status = hasAnyMoney ? "success" : "partial";
  merged.confidence = hasAnyMoney ? "medium" : "low";
  return merged;
}

export function sendSnapshotToBackground(snapshot: PlatformQuote): void {
  try {
    chrome.runtime.sendMessage({ type: "SAVE_SNAPSHOT", snapshot });
  } catch {
    /* extension context may be invalidated during reload */
  }
}

export function sendContextToBackground(context: PageContext): void {
  try {
    chrome.runtime.sendMessage({ type: "SAVE_CONTEXT", context });
  } catch {
    /* extension context may be invalidated during reload */
  }
}

/**
 * Keep sending fresh page snapshots as the user modifies their cart. Uber
 * Eats, DoorDash, and Grubhub render their cart as an in-page drawer and
 * update the DOM in place when items change, so a MutationObserver on
 * <body> catches those updates.
 */
export function observePageChanges(
  scrape: () => PageContext,
  debounceMs = 500,
): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const emit = () => {
    try {
      const context = scrape();
      sendContextToBackground(context);
      sendSnapshotToBackground(context.snapshot);
    } catch {
      /* ignore transient DOM errors */
    }
  };

  const schedule = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(emit, debounceMs);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  // Also emit once on SPA navigations (history changes).
  window.addEventListener("popstate", schedule);
  const origPushState = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    origPushState(...args);
    schedule();
  };
  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    origReplaceState(...args);
    schedule();
  };
}

export function onReady(fn: () => void): void {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    queueMicrotask(fn);
  } else {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

// --- Cart item extraction -------------------------------------------------

export type RawCartRow = {
  name: string | null;
  quantity: number | null;
  price: string | null;
};

export function extractQuantityFromText(text: string | null): number | null {
  if (!text) return null;
  const m =
    text.match(/\b(\d{1,2})\s*[x×]/i) ??
    text.match(/(\d{1,2})\s*×/) ??
    text.match(/\bqty[^\d]*(\d{1,2})/i);
  const n = Number(m?.[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function collectCartRows(rowSelectors: string[]): RawCartRow[] {
  const rows: RawCartRow[] = [];
  const elements = allMatches(rowSelectors);
  for (const el of elements) {
    const titleEl = el.querySelector<HTMLElement>(
      "h3, h4, h5, h6, strong, b, a",
    );
    const rawName = textOf(titleEl) ?? textOf(el);
    const name = cleanItemName(rawName);
    const priceEl = Array.from(el.querySelectorAll<HTMLElement>("*")).find(
      (n) => MONEY_RE.test(n.textContent ?? ""),
    );
    const price = priceEl ? textOf(priceEl) : null;
    const quantity =
      extractQuantityFromText(textOf(el)) ??
      (Number(
        el.querySelector<HTMLInputElement>("input[type=number]")?.value,
      ) ||
        null);
    if (name) rows.push({ name, quantity, price });
  }
  return rows;
}

export function toCartItems(rows: RawCartRow[]): CartItemRequest[] {
  const seen = new Map<string, CartItemRequest>();
  for (const row of rows) {
    if (!row.name) continue;
    const key = row.name.toLowerCase();
    const existing = seen.get(key);
    const qty = row.quantity ?? 1;
    if (existing) {
      existing.quantity += qty;
    } else {
      seen.set(key, { name: row.name, quantity: qty });
    }
  }
  return Array.from(seen.values());
}

export type PageContextParts = {
  address: string | null;
  restaurantName: string | null;
  restaurantUrl: string | null;
  cartRows: RawCartRow[];
  snapshot: PlatformQuote;
};

export function buildPageContext(
  platform: Platform,
  parts: PageContextParts,
): PageContext {
  return {
    platform,
    url: location.href,
    address: cleanAddress(parts.address),
    restaurantName: parts.restaurantName,
    restaurantUrl: parts.restaurantUrl,
    cartItems: toCartItems(parts.cartRows),
    snapshot: parts.snapshot,
  };
}
