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
    firstMatch(['[data-anchor-id="StoreHeaderTitle"]', "h1"]),
  );

  const restaurantAnchor =
    document.querySelector<HTMLAnchorElement>('a[href*="/store/"]');
  const restaurantUrl = restaurantAnchor?.href ?? null;

  const address = textOf(
    firstMatch([
      '[data-anchor-id="AddressDropdown"]',
      '[data-testid="AddressSelector"]',
      'button[aria-label*="address" i]',
    ]),
  );

  const cartRows = collectCartRows([
    '[data-anchor-id="OrderCartItem"]',
    '[data-testid*="CartItem"]',
  ]);

  const menuItems = allMatches([
    '[data-anchor-id="MenuItem"] h3',
    "h3",
  ])
    .map((el) => textOf(el))
    .filter((t): t is string => !!t);

  const subtotalText = textOf(findByLabel([/subtotal/i]));
  const deliveryText = textOf(findByLabel([/delivery fee/i]));
  const serviceText = textOf(findByLabel([/service fee/i]));
  const smallOrderText = textOf(findByLabel([/small order/i]));
  const taxText = textOf(findByLabel([/tax(es)?/i]));
  const finalText = textOf(findByLabel([/\btotal\b/i]));
  const promoText = textOf(findByLabel([/save\s+\$|% off|promo/i]));

  const snapshot = buildSnapshot("doordash", {
    restaurantName,
    restaurantUrl,
    matchedItemName: menuItems[0] ?? null,
    itemSubtotal: extractVisibleMoney(subtotalText),
    deliveryFee: extractVisibleMoney(deliveryText),
    serviceFee: extractVisibleMoney(serviceText),
    smallOrderFee: extractVisibleMoney(smallOrderText),
    tax: extractVisibleMoney(taxText),
    finalTotal: extractVisibleMoney(finalText),
    promoText,
    rawEvidence: {
      subtotalText,
      deliveryFeeText: deliveryText,
      serviceFeeText: serviceText,
      smallOrderFeeText: smallOrderText,
      taxText,
      finalTotalText: finalText,
    },
  });

  return buildPageContext("doordash", {
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
