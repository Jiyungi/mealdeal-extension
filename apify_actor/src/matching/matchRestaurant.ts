import type { RestaurantCandidate } from "../platforms/basePlatform.js";
import { scoreMatch, scoreRestaurantName } from "./scoreMatch.js";

export function matchRestaurant(
  targetName: string,
  candidates: RestaurantCandidate[],
  query: string
): RestaurantCandidate | null {
  let best: RestaurantCandidate | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const nameScore = scoreRestaurantName(targetName, candidate.name);
    const relevanceScore = scoreMatch(query, candidate.rawText);
    const availabilityBonus = candidate.deliveryAvailable ? 0.08 : -0.25;
    const ratingBonus = candidate.rating == null ? 0 : Math.max(0, candidate.rating - 4) * 0.03;
    const etaBonus = candidate.eta ? 0.03 : 0;
    const score = Math.max(0, Math.min(1, nameScore * 0.72 + relevanceScore * 0.17 + availabilityBonus + ratingBonus + etaBonus));

    if (score > bestScore) {
      bestScore = score;
      best = {
        ...candidate,
        score: Number(score.toFixed(3))
      };
    }
  }

  return bestScore >= 0.35 ? best : null;
}
