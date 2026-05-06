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

/**
 * Find the smallest element whose text matches a label pattern. The old
 * version walked `li, tr, div, p, span` and returned the FIRST match,
 * which on a giant `<div>` wrapping the whole cart meant extractVisibleMoney
 * would happily grab the first `$..` in the entire cart pane (usually the
 * tax) when we asked for "subtotal". Preferring the smallest matching
 * node scopes the money lookup to the actual "Subtotal $12.59" row.
 */
export function findByLabel(labelPatterns: RegExp[]): HTMLElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>("li, tr, div, p, span"),
  );
  let best: HTMLElement | null = null;
  let bestLen = Infinity;
  for (const node of nodes) {
    const text = node.textContent ?? "";
    if (!labelPatterns.some((re) => re.test(text))) continue;
    const len = text.length;
    if (len > 0 && len < bestLen) {
      best = node;
      bestLen = len;
    }
  }
  return best;
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
      numberInputQuantity(el) ??
      ariaQuantity(el) ??
      extractQuantityFromText(textOf(el));
    if (name) rows.push({ name, quantity, price });
  }
  return rows;
}

/**
 * Read the quantity from an explicit <input type="number"> in the cart
 * row. Uber Eats, DoorDash, and Grubhub all render the cart quantity as
 * a real form control, which is far more reliable than text heuristics.
 */
function numberInputQuantity(el: Element): number | null {
  const input = el.querySelector<HTMLInputElement>("input[type=number]");
  if (!input) return null;
  const n = Number(input.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Some platforms render the quantity stepper as buttons with aria-labels
 * like "Quantity 2" rather than an input.
 */
function ariaQuantity(el: Element): number | null {
  const nodes = Array.from(
    el.querySelectorAll<HTMLElement>("[aria-label], [aria-valuenow]"),
  );
  for (const node of nodes) {
    const valueNow = node.getAttribute("aria-valuenow");
    if (valueNow) {
      const n = Number(valueNow);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const label = node.getAttribute("aria-label") ?? "";
    const m = label.match(/\bquantity[^\d]*(\d{1,2})\b/i);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

export function toCartItems(rows: RawCartRow[]): CartItemRequest[] {
  // Do NOT sum duplicates across rows. The cart drawer is the single source
  // of truth; if the same name appears more than once (e.g. because the
  // page also renders it as a "featured item"), keep the first occurrence.
  // Summing caused bogus 2× / 3× / 4× quantities on Uber Eats.
  const seen = new Map<string, CartItemRequest>();
  for (const row of rows) {
    if (!row.name) continue;
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    const qty = row.quantity ?? 1;
    seen.set(key, { name: row.name, quantity: qty });
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
