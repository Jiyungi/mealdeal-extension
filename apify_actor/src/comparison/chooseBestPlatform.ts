import type { Platform, PlatformQuote } from "../types.js";
import { compareQuotes } from "./compareQuotes.js";

export function chooseBestPlatform(quotes: PlatformQuote[]): Platform | null {
  return compareQuotes(quotes).bestPlatform;
}
