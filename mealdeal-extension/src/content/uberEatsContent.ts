import {
  allMatches,
  buildPageContext,
  buildSnapshot,
  collectCartRows,
  extractFinalMoney,
  extractVisibleMoney,
  findByLabel,
  firstMatch,
  observePageChanges,
  onReady,
  sendContextToBackground,
  sendSnapshotToBackground,
  textOf,
} from "./genericFoodPageContent";
import { cleanAddress } from "../lib/cleanText";
import type { PageContext } from "../lib/types";

// Uber Eats puts the cart in an in-page drawer (role="dialog") that sits on
// top of the restaurant page when you click "Cart". When the drawer is open
// we can read items straight from it; when it's closed the cart data usually
// stays in the DOM but is hidden. The order header in the drawer is anchored
// by the store name.

function findRestaurantName(): string | null {
  return (
    textOf(firstMatch(['h1[data-testid="store-title"]', 'h1'])) ?? null
  );
}

function findAddress(): string | null {
  // Uber Eats increasingly hides the user's delivery address behind a
  // "Map location" button until clicked, and the surrounding header has
  // noise ("View all cities", "Pickup now", the restaurant's street
  // address, etc.) that can look address-ish to a generic scanner. So we
  // only trust the narrow set of data-testids/aria-labels that Uber uses
  // for the actual user delivery-address control. cleanAddress() will
  // reject anything that doesn't contain a digit.
  const raw = textOf(
    firstMatch([
      '[data-testid="delivery-location"]',
      '[data-testid="delivery-address"]',
      '[aria-label*="delivery address" i]',
      'header button[aria-label*="Enter delivery address" i]',
    ]),
  );
  return cleanAddress(raw);
}

function scrape(): PageContext {
  const restaurantName = findRestaurantName();

  const restaurantAnchor =
    document.querySelector<HTMLAnchorElement>('a[href*="/store/"]');
  const restaurantUrl =
    restaurantAnchor?.href ??
    (location.href.includes("/store/") ? location.href : null);

  const address = findAddress();

  // Try the drawer-scoped cart selectors first, then fall back to generic.
  const cartRows = collectCartRows([
    '[role="dialog"] [data-testid="cart-item"]',
    '[role="dialog"] li[class*="CartItem"]',
    '[data-testid="cart-item"]',
    '[data-testid^="cart-item"]',
    'li[class*="CartItem"]',
  ]);

  const menuItems = allMatches([
    '[data-testid^="store-item"]',
    "li a h4",
  ])
    .map((el) => textOf(el))
    .filter((t): t is string => !!t);

  const subtotalText = textOf(findByLabel([/subtotal/i]));
  const deliveryText = textOf(findByLabel([/delivery fee/i]));
  const serviceText = textOf(findByLabel([/service fee/i]));
  const taxText = textOf(findByLabel([/tax(es)?/i]));
  const finalText = textOf(findByLabel([/\btotal\b/i]));
  const promoText =
    textOf(findByLabel([/saving\s+\$|save\s+\$|% off|\bpromo\b|buy 1.*get 1/i]));

  const snapshot = buildSnapshot("ubereats", {
    restaurantName,
    restaurantUrl,
    matchedItemName: menuItems[0] ?? null,
    itemSubtotal: extractFinalMoney(subtotalText),
    deliveryFee: extractVisibleMoney(deliveryText),
    serviceFee: extractVisibleMoney(serviceText),
    tax: extractVisibleMoney(taxText),
    finalTotal: extractFinalMoney(finalText),
    promoText,
    rawEvidence: {
      subtotalText,
      deliveryFeeText: deliveryText,
      serviceFeeText: serviceText,
      taxText,
      finalTotalText: finalText,
    },
  });

  return buildPageContext("ubereats", {
    address,
    restaurantName,
    restaurantUrl,
    cartRows,
    snapshot,
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_PAGE_CONTEXT") {
    try {
      sendResponse({ ok: true, context: scrape() });
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return true;
  }
  return undefined;
});

onReady(() => {
  try {
    const context = scrape();
    sendContextToBackground(context);
    sendSnapshotToBackground(context.snapshot);
  } catch {
    /* best-effort initial snapshot */
  }
  observePageChanges(scrape);
});
