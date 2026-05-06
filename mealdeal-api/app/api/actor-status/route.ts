import { NextResponse } from "next/server";
import { getRunResult, getRunStatus } from "../../../lib/apifyClient";
import type { ActorStatusResponse } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const runId = new URL(req.url).searchParams.get("runId");
  if (!runId) return error("runId is required.", "", 400);

  try {
    const status = await getRunStatus(runId);
    if (status.status === "complete") {
      const result = await getRunResult(runId);
      if (!result) {
        return json<ActorStatusResponse>({
          status: "error",
          runId,
          message: "Run finished but no result payload was found.",
        });
      }
      return json<ActorStatusResponse>({ status: "complete", runId, result });
    }
    if (status.status === "error") {
      return json<ActorStatusResponse>({
        status: "error",
        runId,
        message: status.message ?? "Actor run failed.",
      });
    }
    return json<ActorStatusResponse>({ status: status.status, runId });
  } catch (err) {
    return error(
      err instanceof Error ? err.message : "Unexpected error.",
      runId,
      500,
    );
  }
}

function json<T>(body: T, status = 200): Response {
  return NextResponse.json(body, { status });
}

function error(message: string, runId: string, status: number): Response {
  return json<ActorStatusResponse>({ status: "error", runId, message }, status);
}
