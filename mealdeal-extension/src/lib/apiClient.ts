import type {
  ActorStatusResponse,
  MealDealRequest,
  RunMealDealResponse,
} from "./types";

export const BASE_URL: string =
  (import.meta.env.VITE_MEALDEAL_API_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:3000";

export async function runMealDeal(
  req: MealDealRequest,
): Promise<RunMealDealResponse> {
  try {
    const response = await fetch(`${BASE_URL}/api/run-mealdeal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!response.ok) {
      return { status: "error", message: await readErrorMessage(response) };
    }
    return (await response.json()) as RunMealDealResponse;
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Network request failed.",
    };
  }
}

export async function getActorStatus(
  runId: string,
): Promise<ActorStatusResponse> {
  try {
    const response = await fetch(
      `${BASE_URL}/api/actor-status?runId=${encodeURIComponent(runId)}`,
    );
    if (!response.ok) {
      return {
        status: "error",
        runId,
        message: await readErrorMessage(response),
      };
    }
    return (await response.json()) as ActorStatusResponse;
  } catch (err) {
    return {
      status: "error",
      runId,
      message: err instanceof Error ? err.message : "Network request failed.",
    };
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body?.message === "string") return body.message;
  } catch {
    /* ignore */
  }
  return `API error (${response.status})`;
}
