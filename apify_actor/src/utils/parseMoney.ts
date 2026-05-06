const MONEY_PATTERN = /(-)?\$\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.([0-9]{2}))?/g;

export function parseMoney(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  MONEY_PATTERN.lastIndex = 0;
  const match = MONEY_PATTERN.exec(value.replace(/\u00a0/g, " "));
  if (!match) {
    return null;
  }

  return normalizeMoneyMatch(match);
}

export function parseMoneyValues(value: string | null | undefined): number[] {
  if (!value) {
    return [];
  }

  MONEY_PATTERN.lastIndex = 0;
  const values: number[] = [];
  for (const match of value.replace(/\u00a0/g, " ").matchAll(MONEY_PATTERN)) {
    values.push(normalizeMoneyMatch(match));
  }
  return values;
}

function normalizeMoneyMatch(match: RegExpMatchArray): number {
  const sign = match[1] ? -1 : 1;
  const dollars = match[2].replace(/,/g, "");
  const cents = match[3] ?? "00";
  const parsed = Number(`${dollars}.${cents}`);
  return Number((sign * parsed).toFixed(2));
}
