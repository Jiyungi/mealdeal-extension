import type { MealDealResult, PlatformQuote } from "../../lib/types";
import { formatUSD } from "../../lib/formatMoney";
import { platformLabel, platformOpenUrl } from "../../lib/platformLinks";
import { truncateForDisplay } from "../../lib/cleanText";
import { filterUserFacingWarnings } from "../../lib/warnings";

type Props = { result: MealDealResult };

/**
 * Which field was the comparison based on for this quote? The Actor prefers
 * `itemSubtotal` across platforms but falls back to `finalTotal` when it's
 * the only thing available. We mirror that priority here so the card
 * headline matches what was actually compared.
 */
function headlineFor(quote: PlatformQuote): {
  value: number | null;
  label: string;
} {
  if (typeof quote.itemSubtotal === "number") {
    return { value: quote.itemSubtotal, label: "Cart subtotal" };
  }
  if (typeof quote.finalTotal === "number") {
    return { value: quote.finalTotal, label: "Total" };
  }
  return { value: null, label: "Cart subtotal" };
}

export default function ResultCard({ result }: Props) {
  const { bestPlatform, bestQuote, savingsVsSecondBest, reason, warnings } =
    result;

  const userWarnings = filterUserFacingWarnings(warnings);

  if (!bestPlatform || !bestQuote) {
    return (
      <div className="result-card result-card--empty">
        <div className="result-card__title">No comparable quotes</div>
        <div className="result-card__reason">
          {reason ||
            "We couldn't confidently pick a platform for this order."}
        </div>
        {userWarnings.length > 0 ? (
          <ul className="result-card__warnings">
            {userWarnings.map((w, i) => (
              <li key={i} title={w}>
                {truncateForDisplay(w, 160)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const headline = headlineFor(bestQuote);

  return (
    <div className="result-card">
      <div className="result-card__eyebrow">Best deal</div>
      <div className="result-card__title">{platformLabel(bestPlatform)}</div>
      <div className="result-card__total">
        {formatUSD(headline.value)}
        <span className="result-card__total-note"> · {headline.label}</span>
      </div>
      {savingsVsSecondBest && savingsVsSecondBest > 0 ? (
        <div className="result-card__savings">
          Save {formatUSD(savingsVsSecondBest)} vs the next cheapest
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
      {userWarnings.length > 0 ? (
        <ul className="result-card__warnings">
          {userWarnings.map((w, i) => (
            <li key={i} title={w}>
              {truncateForDisplay(w, 160)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
