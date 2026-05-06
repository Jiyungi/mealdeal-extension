import type { ActorInput } from "../types.js";
import type { MenuItemCandidate } from "../platforms/basePlatform.js";
import { matchItem } from "../matching/matchItem.js";

export function selectBestItemMatch(
  input: ActorInput,
  items: MenuItemCandidate[]
): MenuItemCandidate | null {
  return matchItem(input.cartItems[0].name, items);
}
