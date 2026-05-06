import type { MealDealResult, PlatformQuote } from "../../lib/types";
import { formatSavings, formatUSD } from "../../lib/formatMoney";
import { platformLabel, platformOpenUrl } from "../../lib/platformLinks";
import { truncateForDisplay } from "../../lib/cleanText";

type Props = { result: MealDealResult };

function cheapestBySubtotal(quotes: PlatformQuote[]): PlatformQuote | null {
  const usable = quotes.filter(
    (q) => typeof q.itemSubtotal === "number" && q.status !== "failed",
  );
  if (usable.length === 0) return null;
  return usable.reduce((best, q) =>
    (q.itemSubtotal ?? Infinity) < (best.itemSubtotal ?? Infinity) ? q : best,
  );
}

export default function ResultCard({ result }: Props) {
  const { bestPlatform, bestQuote, savingsVsMostExpensive, reason, warnings } =
    result;

  // Happy path — Actor confidently picked a winner from visible final totals.
  if (bestPlatform && bestQuote) {
    return (
      <div className="result-card">
        <div className="result-card__eyebrow">Best deal</div>
        <div className="result-card__title">
          {platformLabel(bestPlatform)}
        </div>
        <div className="result-card__total">
          {formatUSD(bestQuote.finalTotal)}
        </div>
        {savingsVsMostExpensive && savingsVsMostExpensive > 0 ? (
          <div className="result-card__savings">
            {formatSavings(savingsVsMostExpensive)}
          </div>
        ) : null}
        <div className="result-card__reason">{reason}</div>
        <a
          className="btn btn--primary"
          href={platformOpenUrl(bestQuote)}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open on {platformLabel(bestPlatform)}
        </a>
        {warnings.length > 0 ? (
          <ul className="result-card__warnings">
            {warnings.map((w, i) => (
              <li key={i} title={w}>
                {truncateForDisplay(w, 160)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  // Degraded path — no quote exposed a full final total, but we may still
  // have a partial subtotal-level signal. Show it with an explicit caveat
  // instead of a blank "no winner" card.
  const subtotalPick = cheapestBySubtotal(result.quotes);

  if (subtotalPick) {
    return (
      <div className="result-card result-card--partial">
        <div className="result-card__eyebrow">Partial result</div>
        <div className="result-card__title">
          {platformLabel(subtotalPick.platform)}
        </div>
        <div className="result-card__total">
          {formatUSD(subtotalPick.itemSubtotal)}
          <span className="result-card__total-note"> subtotal only</span>
        </div>
        <div className="result-card__reason">
          No platform exposed a full visible total (fees and taxes included)
          for your cart, so we can't compare confidently. Showing the lowest
          item subtotal instead.
        </div>
        <a
          className="btn btn--primary"
          href={platformOpenUrl(subtotalPick)}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open on {platformLabel(subtotalPick.platform)}
        </a>
        {warnings.length > 0 ? (
          <ul className="result-card__warnings">
            {warnings.map((w, i) => (
              <li key={i} title={w}>
                {truncateForDisplay(w, 160)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  // Fully empty fallback.
  return (
    <div className="result-card result-card--empty">
      <div className="result-card__title">No comparable quotes</div>
      <div className="result-card__reason">
        {reason ||
          "We couldn't confidently pick a platform for this order."}
      </div>
      {warnings.length > 0 ? (
        <ul className="result-card__warnings">
          {warnings.map((w, i) => (
            <li key={i} title={w}>
              {truncateForDisplay(w, 160)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
