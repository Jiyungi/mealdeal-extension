import type { Platform, PlatformQuote } from "./types";

const LABELS: Record<Platform, string> = {
  ubereats: "Uber Eats",
  doordash: "DoorDash",
  grubhub: "Grubhub",
};

const HOMEPAGES: Record<Platform, string> = {
  ubereats: "https://www.ubereats.com/",
  doordash: "https://www.doordash.com/",
  grubhub: "https://www.grubhub.com/",
};

export function platformLabel(platform: Platform): string {
  return LABELS[platform];
}

export function platformHomepage(platform: Platform): string {
  return HOMEPAGES[platform];
}

export function platformOpenUrl(quote: PlatformQuote): string {
  return (
    quote.checkoutUrl ?? quote.restaurantUrl ?? platformHomepage(quote.platform)
  );
}
