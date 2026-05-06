import { ApifyClient } from "apify-client";
import type { MealDealRequest, MealDealResult } from "./types";

const token = process.env.APIFY_TOKEN;
const actorId = process.env.APIFY_ACTOR_ID;

let client: ApifyClient | null = null;
function getClient(): ApifyClient {
  if (!token) {
    throw new Error("APIFY_TOKEN is not configured on the server.");
  }
  if (!actorId) {
    throw new Error("APIFY_ACTOR_ID is not configured on the server.");
  }
  if (!client) client = new ApifyClient({ token });
  return client;
}

function getActorId(): string {
  if (!actorId) {
    throw new Error("APIFY_ACTOR_ID is not configured on the server.");
  }
  return actorId;
}

export type ActorRunInput = MealDealRequest & {
  maxCandidatesPerPlatform?: number;
  debug?: boolean;
};

export async function startActorRun(
  input: ActorRunInput,
): Promise<{ runId: string }> {
  const run = await getClient().actor(getActorId()).start(input);
  return { runId: run.id };
}

type RunStatus = {
  status: "queued" | "running" | "complete" | "error";
  message?: string;
};

export async function getRunStatus(runId: string): Promise<RunStatus> {
  const run = await getClient().run(runId).get();
  if (!run) return { status: "error", message: "Run not found." };
  switch (run.status) {
    case "READY":
    case "RUNNING":
      return { status: "running" };
    case "SUCCEEDED":
      return { status: "complete" };
    case "FAILED":
    case "ABORTED":
    case "ABORTING":
    case "TIMING-OUT":
    case "TIMED-OUT":
      return {
        status: "error",
        message: `Actor run ${run.status.toLowerCase()}.`,
      };
    default:
      return { status: "queued" };
  }
}

export async function getRunResult(
  runId: string,
): Promise<MealDealResult | null> {
  const run = await getClient().run(runId).get();
  if (!run) return null;
  if (run.defaultKeyValueStoreId) {
    const output = await getClient()
      .keyValueStore(run.defaultKeyValueStoreId)
      .getRecord("OUTPUT");
    if (output?.value) return output.value as MealDealResult;
  }
  if (run.defaultDatasetId) {
    const { items } = await getClient()
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 1 });
    if (items.length > 0) return items[0] as unknown as MealDealResult;
  }
  return null;
}

export async function waitForRunResult(
  runId: string,
  timeoutMs: number,
): Promise<MealDealResult | null> {
  const waitSecs = Math.max(1, Math.floor(timeoutMs / 1000));
  const run = await getClient().run(runId).waitForFinish({ waitSecs });
  if (!run) return null;
  if (run.status !== "SUCCEEDED") return null;
  return getRunResult(runId);
}
