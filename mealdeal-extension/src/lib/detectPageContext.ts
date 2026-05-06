import type { PageContext, Platform } from "./types";
import { loadFreshestCachedPageContext, loadHomeAddress } from "./storage";

const HOST_TO_PLATFORM: Record<string, Platform> = {
  "www.ubereats.com": "ubereats",
  "ubereats.com": "ubereats",
  "www.doordash.com": "doordash",
  "doordash.com": "doordash",
  "www.grubhub.com": "grubhub",
  "grubhub.com": "grubhub",
};

export function platformForUrl(url: string | undefined): Platform | null {
  if (!url) return null;
  try {
    return HOST_TO_PLATFORM[new URL(url).hostname] ?? null;
  } catch {
    return null;
  }
}

export type DetectedContext =
  | { status: "ok"; context: PageContext; source: "live" }
  | {
      status: "ok";
      context: PageContext;
      source: "cache";
      updatedAt: number;
    }
  | { status: "unsupported" }
  | { status: "error"; message: string };

export async function detectActiveTabContext(): Promise<DetectedContext> {
  const live = await detectFromActiveTab();
  if (live.status === "ok") {
    return fillAddressFallback(live);
  }

  // Active tab isn't a delivery site (or the live scrape failed). Fall back
  // to the most recently observed cart from any platform.
  const cached = await loadFreshestCachedPageContext();
  if (cached) {
    return fillAddressFallback({
      status: "ok",
      context: cached.context,
      source: "cache",
      updatedAt: cached.updatedAt,
    });
  }
  return live;
}

// If the page didn't expose an address (Uber Eats increasingly hides it
// behind the "Map location" picker until clicked), substitute the user's
// saved home address so the Compare button isn't stuck.
async function fillAddressFallback(
  detection: DetectedContext,
): Promise<DetectedContext> {
  if (detection.status !== "ok") return detection;
  if (detection.context.address) return detection;
  const home = await loadHomeAddress();
  if (!home) return detection;
  return {
    ...detection,
    context: { ...detection.context, address: home },
  };
}

async function detectFromActiveTab(): Promise<DetectedContext> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !tab.url) return { status: "unsupported" };
    const platform = platformForUrl(tab.url);
    if (!platform) return { status: "unsupported" };

    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: "GET_PAGE_CONTEXT",
    })) as
      | { ok: true; context: PageContext }
      | { ok: false; error: string }
      | undefined;

    if (!response) {
      return {
        status: "error",
        message: "No response from the page. Reload the tab and try again.",
      };
    }
    if (!response.ok) {
      return { status: "error", message: response.error };
    }
    return { status: "ok", context: response.context, source: "live" };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
