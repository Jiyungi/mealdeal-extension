// Helpers for cleaning up raw page text extracted by content scripts.
// Real delivery-site DOM elements often bundle label + value + chrome
// (arrows, "Change" buttons, etc.) inside one accessible name, so we need
// to scrub that down to the useful value before showing it to the user.

const ADDRESS_PREFIXES = [
  /^\s*(delivery|deliver|delivering)\s+(to|address)\s*:?\s*/i,
  /^\s*address\s*:?\s*/i,
  /^\s*current\s+address\s*:?\s*/i,
  /^\s*your\s+address\s*:?\s*/i,
];

const ADDRESS_SUFFIX_NOISE = [
  /\b(change|edit|update)\s*(address)?\s*$/i,
  /[▼▾⌄▽]\s*$/,
  /\s*\bchange\b[\s\S]*$/i,
];

const MONEY_CHUNK = /\$\s?\d+(?:[.,]\d{1,2})?/g;

// Phrases Uber Eats/DoorDash/Grubhub concatenate into the cart-item block
// alongside the item name (modifier labels, BOGO tags, promo copy).
const DESCRIPTION_MARKERS = [
  "Choice of",
  "Select Size",
  "Select Protein",
  "Select Sauce",
  "Select Toppings",
  "Select ",
  "Size:",
  "Add ",
  "With ",
  "Substitutions",
  "Instructions",
  "Special instructions",
  "Side of",
  "Buy 1",
  "Buy 2",
  "Save $",
  "Save up to",
  "Free delivery",
];

/**
 * Normalize an address-like string pulled from a platform's address
 * dropdown/button. Collapses whitespace, strips common label prefixes
 * ("Delivery to:") and trailing UI chrome ("Change", "▼"). Returns null
 * if the result doesn't look like a real address (no digits at all —
 * real US delivery addresses always have a street number or ZIP).
 */
export function cleanAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.replace(/\s+/g, " ").trim();
  for (const re of ADDRESS_PREFIXES) text = text.replace(re, "");
  for (const re of ADDRESS_SUFFIX_NOISE) text = text.replace(re, "");
  text = text.trim();
  if (text.length === 0) return null;
  // Reject junk like "View all cities", "Map location", "Pickup now" that
  // live in the header and look address-ish to our selectors but contain
  // no street number or ZIP.
  if (!/\d/.test(text)) return null;
  if (/^(view|map|search|pickup|pick up)\b/i.test(text)) return null;
  return text;
}

/**
 * Normalize a menu/cart item name. Strips any embedded dollar amounts
 * (real pages often render "Chicken Pad Thai $15.99 $12.99" when there's
 * a promo) and collapses whitespace. Also caps to the first line so we
 * don't pull descriptions along with the title, and cuts off embedded
 * modifier labels like "Choice of Protein" that delivery sites concatenate
 * into the same text node.
 */
export function cleanItemName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const firstLine = raw.split(/\r?\n/)[0] ?? raw;
  const noMoney = firstLine.replace(MONEY_CHUNK, " ");

  // Insert spaces before capitalized-phrase markers that are glued into
  // the previous word (e.g. "Rice PlattersChoice of Protein: Chicken").
  let spaced = noMoney;
  for (const marker of DESCRIPTION_MARKERS) {
    const re = new RegExp(`(?=${escapeForRegex(marker)})`, "g");
    spaced = spaced.replace(re, " ");
  }
  // Also break before obvious "Word: " sub-labels.
  spaced = spaced.replace(/([a-z])([A-Z][a-z]+:\s)/g, "$1 $2");

  const collapsed = spaced.replace(/\s+/g, " ").trim();

  // Cut before the first modifier marker.
  let truncated = collapsed;
  for (const marker of DESCRIPTION_MARKERS) {
    const idx = truncated.indexOf(marker);
    if (idx > 0) truncated = truncated.slice(0, idx).trim();
  }

  // Drop trailing bullets/dashes left behind after stripping prices.
  const trimmed = truncated.replace(/[\s\-–—·|]+$/u, "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Truncate long free-text strings to keep the UI from overflowing when the
 * Actor returns malformed output (e.g., when selectors grab an entire page
 * of HTML into a field like `restaurantName`). Soft-limits, preserves word
 * boundaries when possible.
 */
export function truncateForDisplay(
  value: string | null | undefined,
  max = 80,
): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const head = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return head.trimEnd() + "…";
}

/**
 * Restaurant-name scrub. Real delivery pages are stateful React trees, and
 * a broken scraper selector can return literally everything on the page
 * concatenated into one string (nav items, "Skip to content", the menu,
 * reviews, schema.org JSON-LD, etc.). None of that is a restaurant name.
 *
 * This detects that failure mode and returns null so the UI can hide the
 * field instead of showing "Skip to contentThree linesLocation marker…".
 */
export function sanitizeRestaurantName(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;

  // Obviously wrong if there's no space at all after 50+ chars (glued CamelCase garbage)
  // or if the string is pathologically long.
  if (text.length > 120) return null;
  if (text.length > 50 && !text.includes(" ")) return null;

  // Chrome/Uber nav phrases that mean the selector grabbed the whole page.
  const garbageMarkers = [
    "Skip to content",
    "Three lines",
    "Location marker",
    "Map location",
    "Javascript disabled",
    "View all cities",
    "Sign up to deliver",
    '"@context":"https://schema.org"',
  ];
  for (const marker of garbageMarkers) {
    if (text.includes(marker)) return null;
  }

  return text;
}
