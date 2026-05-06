import type { MealDealResult } from "../../lib/types";
import { formatSavings, formatUSD } from "../../lib/formatMoney";
import { platformLabel, platformOpenUrl } from "../../lib/platformLinks";

type Props = { result: MealDealResult };

export default function ResultCard({ result }: Props) {
  const { bestPlatform, bestQuote, savingsVsMostExpensive, reason, warnings } =
    result;

  if (!bestPlatform || !bestQuote) {
    return (
      <div className="result-card result-card--empty">
        <div className="result-card__title">No winner yet</div>
        <div className="result-card__reason">
          {reason || "We couldn't confidently pick a platform for this order."}
        </div>
      </div>
    );
  }

  return (
    <div className="result-card">
      <div className="result-card__eyebrow">Best deal</div>
      <div className="result-card__title">{platformLabel(bestPlatform)}</div>
      <div className="result-card__total">{formatUSD(bestQuote.finalTotal)}</div>
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
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
