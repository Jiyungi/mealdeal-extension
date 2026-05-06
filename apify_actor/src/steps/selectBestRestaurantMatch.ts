import type { ActorInput } from "../types.js";
import type { RestaurantCandidate } from "../platforms/basePlatform.js";
import { matchRestaurant } from "../matching/matchRestaurant.js";

export function selectBestRestaurantMatch(
  input: ActorInput,
  candidates: RestaurantCandidate[]
): RestaurantCandidate | null {
  const target = input.restaurantName ?? input.query;
  return matchRestaurant(target, candidates, input.query);
}
