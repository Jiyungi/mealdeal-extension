import { NextResponse } from "next/server";
import {
  startActorRun,
  waitForRunResult,
} from "../../../lib/apifyClient";
import { validateMealDealRequest } from "../../../lib/validate";
import type { RunMealDealResponse } from "../../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WAIT_MS = Number(process.env.MEALDEAL_MAX_WAIT_MS ?? 60_000);

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON body.");
  }

  const parsed = validateMealDealRequest(body);
  if (!parsed.ok) return error(400, parsed.error);

  let runId: string;
  try {
    const started = await startActorRun(parsed.input);
    runId = started.runId;
  } catch (err) {
    return error(500, messageOf(err));
  }

  try {
    const result = await waitForRunResult(runId, MAX_WAIT_MS);
    if (result) {
      return json<RunMealDealResponse>({ status: "complete", result });
    }
    return json<RunMealDealResponse>({ status: "running", runId });
  } catch (err) {
    return json<RunMealDealResponse>({
      status: "error",
      message: messageOf(err),
    });
  }
}

function json<T>(body: T, status = 200): Response {
  return NextResponse.json(body, { status });
}

function error(status: number, message: string): Response {
  return json<RunMealDealResponse>({ status: "error", message }, status);
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error.";
}
