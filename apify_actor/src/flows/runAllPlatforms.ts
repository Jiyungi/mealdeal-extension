import { DoorDashAdapter } from "../platforms/doorDash.js";
import { GrubhubAdapter } from "../platforms/grubhub.js";
import { UberEatsAdapter } from "../platforms/uberEats.js";
import type { ActorInput, Platform, PlatformQuote } from "../types.js";
import type { PlatformAdapter } from "../platforms/basePlatform.js";
import { resolveDoorDashStoreUrls, runDoorDashExternalQuoteFlow } from "../platforms/doorDashExternal.js";
import { runPlatformQuoteFlow } from "./runPlatformQuoteFlow.js";

export async function runAllPlatforms(input: ActorInput): Promise<PlatformQuote[]> {
  const snapshots = selectSnapshotsByPlatform(input.userVisibleSnapshots);
  const quotes: PlatformQuote[] = [];

  for (const platform of input.platforms) {
    const snapshot = snapshots.get(platform);
    if (snapshot) {
      quotes.push(withSnapshotWarning(snapshot));
      continue;
    }

    if (platform === "doordash") {
      const externalQuote = await runDoorDashExternalQuoteFlow(input);
      if (externalQuote && (externalQuote.itemSubtotal != null || resolveDoorDashStoreUrls(input).length > 0)) {
        quotes.push(externalQuote);
        continue;
      }
    }

    const adapter = createAdapter(platform);
    quotes.push(await runPlatformQuoteFlow(adapter, input));
  }

  return quotes;
}

function selectSnapshotsByPlatform(
  snapshots: PlatformQuote[] | undefined
): Map<Platform, PlatformQuote> {
  const selected = new Map<Platform, PlatformQuote>();
  for (const snapshot of snapshots ?? []) {
    const existing = selected.get(snapshot.platform);
    if (!existing || rankSnapshot(snapshot) > rankSnapshot(existing)) {
      selected.set(snapshot.platform, snapshot);
    }
  }
  return selected;
}

function rankSnapshot(snapshot: PlatformQuote): number {
  const statusRank = snapshot.status === "success" ? 100 : snapshot.status === "partial" ? 50 : 0;
  const subtotalRank = snapshot.itemSubtotal == null ? 0 : 1000;
  const confidenceRank = snapshot.confidence === "high" ? 10 : snapshot.confidence === "medium" ? 5 : 1;
  return subtotalRank + statusRank + confidenceRank;
}

function withSnapshotWarning(snapshot: PlatformQuote): PlatformQuote {
  return {
    ...snapshot,
    warnings: Array.from(
      new Set([
        ...snapshot.warnings,
        `${platformLabel(snapshot.platform)} user-visible snapshot supplied; live scraping skipped for this platform.`
      ])
    )
  };
}

function createAdapter(platform: Platform): PlatformAdapter {
  switch (platform) {
    case "ubereats":
      return new UberEatsAdapter();
    case "doordash":
      return new DoorDashAdapter();
    case "grubhub":
      return new GrubhubAdapter();
  }
}

function platformLabel(platform: Platform): string {
  switch (platform) {
    case "ubereats":
      return "Uber Eats";
    case "doordash":
      return "DoorDash";
    case "grubhub":
      return "Grubhub";
  }
}
