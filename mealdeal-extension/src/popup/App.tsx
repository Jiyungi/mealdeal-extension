import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ActorStatusResponse,
  MealDealRequest,
  MealDealResult,
  PageContext,
  Platform,
  PlatformQuote,
  RunMealDealResponse,
} from "../lib/types";
import { PLATFORMS } from "../lib/types";
import {
  loadLastRequest,
  loadLastResult,
  loadPlatformSnapshots,
  saveLastRequest,
  saveLastResult,
} from "../lib/storage";
import { getActorStatus, runMealDeal } from "../lib/apiClient";
import { detectActiveTabContext } from "../lib/detectPageContext";
import SearchForm from "./components/SearchForm";
import LoadingState from "./components/LoadingState";
import ResultCard from "./components/ResultCard";
import QuoteTable from "./components/QuoteTable";
import ErrorState from "./components/ErrorState";
import DetectedCart from "./components/DetectedCart";
import DetectionBanner from "./components/DetectionBanner";
import type { PlatformRunStatus } from "./components/PlatformStatusCard";

type Detection =
  | { status: "pending" }
  | { status: "ok"; context: PageContext; source: "live" }
  | {
      status: "ok";
      context: PageContext;
      source: "cache";
      updatedAt: number;
    }
  | { status: "unsupported" }
  | { status: "error"; message: string };

type Phase =
  | { kind: "detecting" }
  | { kind: "detected" }
  | { kind: "manual" }
  | { kind: "running"; runId: string | null; platforms: Platform[] }
  | { kind: "complete"; result: MealDealResult }
  | { kind: "error"; message: string };

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: "detecting" });
  const [detection, setDetection] = useState<Detection>({ status: "pending" });
  const [initialValues, setInitialValues] = useState<
    Partial<MealDealRequest> | undefined
  >(undefined);
  const [snapshots, setSnapshots] = useState<PlatformQuote[]>([]);
  const [platformStatuses, setPlatformStatuses] = useState<
    Partial<Record<Platform, PlatformRunStatus>>
  >({});
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [lastReq, lastResult, snaps, detected] = await Promise.all([
        loadLastRequest(),
        loadLastResult(),
        loadPlatformSnapshots(),
        detectActiveTabContext(),
      ]);
      if (lastReq) setInitialValues(lastReq);
      setSnapshots(snaps);

      if (detected.status === "ok") {
        setDetection(detected);
        setPhase({ kind: "detected" });
        return;
      }
      if (detected.status === "unsupported") {
        setDetection({ status: "unsupported" });
      } else {
        setDetection({ status: "error", message: detected.message });
      }
      setPhase(lastResult ? { kind: "complete", result: lastResult } : { kind: "manual" });
    })();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const finalize = useCallback(
    async (result: MealDealResult) => {
      stopPolling();
      await saveLastResult(result);
      const nextStatuses: Partial<Record<Platform, PlatformRunStatus>> = {};
      for (const q of result.quotes) {
        nextStatuses[q.platform] = q.status;
      }
      setPlatformStatuses(nextStatuses);
      setPhase({ kind: "complete", result });
    },
    [stopPolling],
  );

  const pollUntilDone = useCallback(
    (runId: string, startedAt: number) => {
      const tick = async () => {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setPhase({
            kind: "error",
            message: "Timed out waiting for the Actor. Try again.",
          });
          stopPolling();
          return;
        }
        const res: ActorStatusResponse = await getActorStatus(runId);
        if (res.status === "complete") {
          await finalize(res.result);
        } else if (res.status === "error") {
          setPhase({ kind: "error", message: res.message });
          stopPolling();
        } else {
          pollTimer.current = window.setTimeout(tick, POLL_INTERVAL_MS);
        }
      };
      pollTimer.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    },
    [finalize, stopPolling],
  );

  const runWith = useCallback(
    async (req: MealDealRequest) => {
      const allSnapshots =
        detection.status === "ok"
          ? [detection.context.snapshot, ...snapshots]
          : snapshots;
      const doorDashStoreUrls = collectDoorDashStoreUrls(
        detection.status === "ok" ? detection.context : null,
        allSnapshots,
      );
      const withSnapshots: MealDealRequest = {
        ...req,
        userVisibleSnapshots: allSnapshots,
        doorDashStoreUrls: doorDashStoreUrls.length > 0
          ? doorDashStoreUrls
          : undefined,
      };
      await saveLastRequest(req);
      setInitialValues(req);
      setPhase({ kind: "running", runId: null, platforms: req.platforms });
      setPlatformStatuses(
        Object.fromEntries(
          req.platforms.map((p) => [p, "running" as PlatformRunStatus]),
        ) as Record<Platform, PlatformRunStatus>,
      );

      const res: RunMealDealResponse = await runMealDeal(withSnapshots);
      if (res.status === "complete") {
        await finalize(res.result);
        return;
      }
      if (res.status === "error") {
        setPhase({ kind: "error", message: res.message });
        return;
      }
      setPhase({
        kind: "running",
        runId: res.runId,
        platforms: req.platforms,
      });
      pollUntilDone(res.runId, Date.now());
    },
    [detection, finalize, pollUntilDone, snapshots],
  );

  const handleCompareDetected = useCallback(
    async (otherPlatforms: Platform[], overrideAddress?: string) => {
      if (detection.status !== "ok") return;
      const ctx = detection.context;
      const query =
        ctx.cartItems[0]?.name ?? ctx.restaurantName ?? "";
      const req: MealDealRequest = {
        address: overrideAddress ?? ctx.address ?? "",
        restaurantName: ctx.restaurantName ?? undefined,
        query,
        cartItems: ctx.cartItems,
        platforms: [ctx.platform, ...otherPlatforms],
      };
      await runWith(req);
    },
    [detection, runWith],
  );

  const handleManualSubmit = useCallback(
    (req: MealDealRequest) => runWith(req),
    [runWith],
  );

  const handleReset = useCallback(() => {
    stopPolling();
    setPhase(detection.status === "ok" ? { kind: "detected" } : { kind: "manual" });
  }, [detection, stopPolling]);

  const handleEditManually = useCallback(() => {
    stopPolling();
    setPhase({ kind: "manual" });
  }, [stopPolling]);

  const runningPlatforms = useMemo(
    () =>
      phase.kind === "running"
        ? phase.platforms
        : ([...PLATFORMS] as Platform[]),
    [phase],
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>MealDeal</h1>
        <p className="app__tagline">
          Compare the real cost of your cart across Uber Eats, DoorDash, and
          Grubhub.
        </p>
      </header>

      {phase.kind === "detecting" ? (
        <div className="detecting">
          <span className="spinner" aria-hidden="true" />
          <span>Reading your cart…</span>
        </div>
      ) : null}

      {phase.kind === "detected" && detection.status === "ok" ? (
        <DetectedCart
          context={detection.context}
          source={detection.source}
          updatedAt={
            detection.source === "cache" ? detection.updatedAt : undefined
          }
          submitting={false}
          onCompare={handleCompareDetected}
          onEditManually={handleEditManually}
        />
      ) : null}

      {phase.kind === "manual" ? (
        <>
          {detection.status === "unsupported" ? (
            <DetectionBanner kind="unsupported" onManual={() => {}} />
          ) : null}
          {detection.status === "error" ? (
            <DetectionBanner
              kind="error"
              message={detection.message}
              onManual={() => {}}
            />
          ) : null}
          <SearchForm
            initialValues={initialValues}
            submitting={false}
            onSubmit={handleManualSubmit}
          />
        </>
      ) : null}

      {phase.kind === "running" ? (
        <LoadingState
          platforms={runningPlatforms}
          statuses={platformStatuses}
        />
      ) : null}

      {phase.kind === "complete" ? (
        <section className="results">
          <ResultCard result={phase.result} />
          <QuoteTable
            quotes={phase.result.quotes}
            bestPlatform={phase.result.bestPlatform}
          />
          <button className="btn btn--ghost" onClick={handleReset}>
            New search
          </button>
        </section>
      ) : null}

      {phase.kind === "error" ? (
        <ErrorState message={phase.message} onRetry={handleReset} />
      ) : null}
    </div>
  );
}

// Pull any DoorDash /store/ URLs we've seen — either the active tab (if the
// user is browsing DoorDash right now) or an earlier cached snapshot from a
// previous DoorDash visit. Person B's Actor can hand these to its Apify
// Store fallback instead of trying the browser path that DoorDash blocks.
function collectDoorDashStoreUrls(
  context: PageContext | null,
  snapshots: PlatformQuote[],
): string[] {
  const urls = new Set<string>();
  const accept = (raw: string | null | undefined) => {
    if (!raw) return;
    try {
      const u = new URL(raw);
      if (
        u.hostname.includes("doordash.com") &&
        u.pathname.includes("/store/")
      ) {
        urls.add(u.toString());
      }
    } catch {
      /* ignore */
    }
  };
  if (context?.platform === "doordash") {
    accept(context.restaurantUrl);
    accept(context.url);
  }
  for (const snap of snapshots) {
    if (snap.platform === "doordash") {
      accept(snap.restaurantUrl);
      accept(snap.checkoutUrl);
    }
  }
  return Array.from(urls);
}
