import { parseQuoteFieldsFromText } from "./extractFees.js";

export function extractFinalTotalFromText(text: string): number | null {
  return parseQuoteFieldsFromText(text).finalTotal;
}
