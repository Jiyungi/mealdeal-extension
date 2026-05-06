// Display helpers for currency and savings.

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUSD(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return USD.format(value);
}

export function formatSavings(value: number | null | undefined): string {
  if (value === null || value === undefined || value <= 0) return "";
  return `Save ${formatUSD(value)} vs most expensive`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}
