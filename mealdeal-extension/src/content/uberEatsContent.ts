import {
  allMatches,
  buildPageContext,
  buildSnapshot,
  collectCartRows,
  extractVisibleMoney,
  findByLabel,
  firstMatch,
  onReady,
  sendSnapshotToBackground,
  textOf,
} from "./genericFoodPageContent";
import type { PageContext } from "../lib/types";

function scrape(): PageContext {
  const restaurantName = textOf(
    firstMatch(['h1[data-testid="store-title"]', "h1"]),
  );

  const restaurantAnchor =
    document.querySelector<HTMLAnchorElement>('a[href*="/store/"]');
  const restaurantUrl = restaurantAnchor?.href ?? null;

  const address = textOf(
    firstMatch([
      '[data-testid="delivery-address"]',
      '[aria-label*="delivery address" i]',
      'button[aria-label*="address" i]',
    ]),
  );

  const cartRows = collectCartRows([
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
  const promoText = textOf(findByLabel([/save\s+\$|% off|promo/i]));

  const snapshot = buildSnapshot("ubereats", {
    restaurantName,
    restaurantUrl,
    matchedItemName: menuItems[0] ?? null,
    itemSubtotal: extractVisibleMoney(subtotalText),
    deliveryFee: extractVisibleMoney(deliveryText),
    serviceFee: extractVisibleMoney(serviceText),
    tax: extractVisibleMoney(taxText),
    finalTotal: extractVisibleMoney(finalText),
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
    sendSnapshotToBackground(scrape().snapshot);
  } catch {
    /* best-effort background snapshot */
  }
});
