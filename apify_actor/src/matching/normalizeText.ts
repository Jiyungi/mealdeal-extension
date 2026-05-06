const PLATFORM_WORDS = ["ubereats", "uber eats", "doordash", "door dash", "grubhub", "grub hub"];
const RESTAURANT_FILLER = ["near me", "delivery", "takeout", "pickup", "restaurant", "restaurants", "menu"];

const ITEM_ALIASES: Array<[RegExp, string]> = [
  [/\bpad\s*thai\b/g, " padthai "],
  [/\bthai\s+noodles?\b/g, " padthai "],
  [/\bwok\s*fired\b/g, " "],
  [/\bw\/\b/g, " with "],
  [/\bcrispy\b/g, " "],
  [/\bgrilled\b/g, " "]
];

export function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeRestaurantText(value: string | null | undefined): string {
  let normalized = normalizeText(value);
  for (const word of [...PLATFORM_WORDS, ...RESTAURANT_FILLER]) {
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, "g"), " ");
  }
  return normalized
    .replace(/\b(st|street|ave|avenue|rd|road|blvd|boulevard|suite|ste)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeItemText(value: string | null | undefined): string {
  let normalized = normalizeText(value);
  for (const [pattern, replacement] of ITEM_ALIASES) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized
    .replace(/\b(combo|meal|order|item|classic)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
