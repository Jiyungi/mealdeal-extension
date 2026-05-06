import { getActorStatus, runMealDeal } from "../lib/apiClient";
import {
  saveLastRequest,
  saveLastResult,
  savePlatformSnapshot,
} from "../lib/storage";
import type {
  ActorStatusResponse,
  MealDealRequest,
  PlatformQuote,
  RunMealDealResponse,
} from "../lib/types";

type RuntimeMessage =
  | { type: "RUN_MEALDEAL"; payload: MealDealRequest }
  | { type: "GET_ACTOR_STATUS"; runId: string }
  | { type: "SAVE_SNAPSHOT"; snapshot: PlatformQuote };

type RuntimeResponse =
  | { type: "RUN_MEALDEAL"; data: RunMealDealResponse }
  | { type: "GET_ACTOR_STATUS"; data: ActorStatusResponse }
  | { type: "SAVE_SNAPSHOT"; ok: true };

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    handle(message).then(sendResponse).catch((err) => {
      sendResponse({
        type: message.type,
        error: err instanceof Error ? err.message : String(err),
      });
    });
    // Keep the message channel open for the async response.
    return true;
  },
);

async function handle(message: RuntimeMessage): Promise<RuntimeResponse> {
  switch (message.type) {
    case "RUN_MEALDEAL": {
      await saveLastRequest(message.payload);
      const data = await runMealDeal(message.payload);
      if (data.status === "complete") {
        await saveLastResult(data.result);
      }
      return { type: "RUN_MEALDEAL", data };
    }
    case "GET_ACTOR_STATUS": {
      const data = await getActorStatus(message.runId);
      if (data.status === "complete") {
        await saveLastResult(data.result);
      }
      return { type: "GET_ACTOR_STATUS", data };
    }
    case "SAVE_SNAPSHOT": {
      await savePlatformSnapshot(message.snapshot);
      return { type: "SAVE_SNAPSHOT", ok: true };
    }
  }
}
