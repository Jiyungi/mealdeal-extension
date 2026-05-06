import type { MealDealRequest, MealDealResult, PlatformQuote } from "./types";

const KEY_LAST_REQUEST = "mealdeal:lastRequest";
const KEY_LAST_RESULT = "mealdeal:lastResult";
const KEY_SNAPSHOTS = "mealdeal:platformSnapshots";

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
