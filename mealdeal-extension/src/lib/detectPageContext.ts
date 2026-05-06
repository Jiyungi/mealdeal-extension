import type { PageContext, Platform } from "./types";

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
  | { status: "ok"; context: PageContext }
  | { status: "unsupported" }
  | { status: "error"; message: string };

export async function detectActiveTabContext(): Promise<DetectedContext> {
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
        message:
          "No response from the page. Reload the tab and try again.",
      };
    }
    if (!response.ok) {
      return { status: "error", message: response.error };
    }
    return { status: "ok", context: response.context };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
