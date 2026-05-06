import type { MenuItemCandidate } from "../platforms/basePlatform.js";
import { normalizeItemText } from "./normalizeText.js";
import { scoreMatch } from "./scoreMatch.js";

export function matchItem(
  requestedName: string,
  candidates: MenuItemCandidate[]
): MenuItemCandidate | null {
  const requested = normalizeItemText(requestedName);
  let best: MenuItemCandidate | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateName = normalizeItemText(candidate.name);
    const score = Math.max(scoreMatch(requested, candidateName), scoreMatch(requested, candidate.rawText));
    if (score > bestScore) {
      bestScore = score;
      best = {
        ...candidate,
        matchScore: Number(score.toFixed(3))
      };
    }
  }

  return bestScore >= 0.45 ? best : null;
}
