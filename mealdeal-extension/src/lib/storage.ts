import type {
  MealDealRequest,
  MealDealResult,
  PageContext,
  Platform,
  PlatformQuote,
} from "./types";

const KEY_LAST_REQUEST = "mealdeal:lastRequest";
const KEY_LAST_RESULT = "mealdeal:lastResult";
const KEY_SNAPSHOTS = "mealdeal:platformSnapshots";
const KEY_CACHED_CONTEXT_PREFIX = "mealdeal:cachedContext:";
const KEY_HOME_ADDRESS = "mealdeal:homeAddress";

export type CachedPageContext = {
  context: PageContext;
  updatedAt: number;
};

async function get<T>(key: string): Promise<T | null> {
  const bag = await chrome.storage.local.get(key);
  return (bag[key] as T | undefined) ?? null;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export function saveLastRequest(req: MealDealRequest): Promise<void> {
  return set(KEY_LAST_REQUEST, req);
}

export function loadLastRequest(): Promise<MealDealRequest | null> {
  return get<MealDealRequest>(KEY_LAST_REQUEST);
}

export function saveLastResult(result: MealDealResult): Promise<void> {
  return set(KEY_LAST_RESULT, result);
}

export function loadLastResult(): Promise<MealDealResult | null> {
  return get<MealDealResult>(KEY_LAST_RESULT);
}

export async function savePlatformSnapshot(
  snapshot: PlatformQuote,
): Promise<void> {
  const existing = (await get<PlatformQuote[]>(KEY_SNAPSHOTS)) ?? [];
  const deduped = existing.filter((s) => s.platform !== snapshot.platform);
  deduped.push(snapshot);
  await set(KEY_SNAPSHOTS, deduped);
}

export async function loadPlatformSnapshots(): Promise<PlatformQuote[]> {
  return (await get<PlatformQuote[]>(KEY_SNAPSHOTS)) ?? [];
}

export async function clearPlatformSnapshots(): Promise<void> {
  await set(KEY_SNAPSHOTS, []);
}

/**
 * Persist the most recently observed page context (cart + address + snapshot)
 * for a platform. Lets the popup show the user's last-seen cart even when the
 * currently active tab isn't a delivery site.
 */
export async function saveCachedPageContext(
  context: PageContext,
): Promise<void> {
  await set(KEY_CACHED_CONTEXT_PREFIX + context.platform, {
    context,
    updatedAt: Date.now(),
  });
}

export async function loadCachedPageContext(
  platform: Platform,
): Promise<CachedPageContext | null> {
  return get<CachedPageContext>(KEY_CACHED_CONTEXT_PREFIX + platform);
}

export async function loadAllCachedPageContexts(): Promise<CachedPageContext[]> {
  const platforms: Platform[] = ["ubereats", "doordash", "grubhub"];
  const results = await Promise.all(
    platforms.map((p) => loadCachedPageContext(p)),
  );
  return results.filter((c): c is CachedPageContext => c !== null);
}

export async function loadFreshestCachedPageContext(): Promise<CachedPageContext | null> {
  const all = await loadAllCachedPageContexts();
  if (all.length === 0) return null;
  return all.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/**
 * User's saved home/default delivery address. Used to pre-fill the
 * search form and as a fallback when the current delivery-site tab
 * doesn't expose the address in its DOM.
 */
export function saveHomeAddress(address: string): Promise<void> {
  return set(KEY_HOME_ADDRESS, address);
}

export function loadHomeAddress(): Promise<string | null> {
  return get<string>(KEY_HOME_ADDRESS);
}

export function clearHomeAddress(): Promise<void> {
  return set(KEY_HOME_ADDRESS, null);
}
