import type { Platform, PlatformQuote } from "../../lib/types";
import { formatUSD } from "../../lib/formatMoney";
import { platformLabel, platformOpenUrl } from "../../lib/platformLinks";
import { truncateForDisplay } from "../../lib/cleanText";

type Props = {
  quotes: PlatformQuote[];
  bestPlatform: Platform | null;
};

export default function QuoteTable({ quotes, bestPlatform }: Props) {
  if (quotes.length === 0) return null;
  return (
    <div className="quote-table">
      <div className="quote-table__header">
        <span>Platform</span>
        <span>Subtotal</span>
        <span>Fees</span>
        <span>Total</span>
        <span>ETA</span>
        <span />
      </div>
      {quotes.map((q) => {
        const fees = sumFees(q);
        const isBest = q.platform === bestPlatform;
        const restaurant = truncateForDisplay(q.restaurantName, 40);
        const promo = truncateForDisplay(q.promoText, 60);
        return (
          <div
            key={q.platform}
            className={`quote-table__row${isBest ? " quote-table__row--best" : ""}${
              q.status === "failed" ? " quote-table__row--failed" : ""
            }`}
          >
            <span>
              <strong>{platformLabel(q.platform)}</strong>
              {restaurant ? (
                <small className="muted" title={q.restaurantName ?? ""}>
                  {" "}
                  · {restaurant}
                </small>
              ) : null}
              {promo ? (
                <div className="badge" title={q.promoText ?? ""}>
                  {promo}
                </div>
              ) : null}
            </span>
            <span>{formatUSD(q.itemSubtotal)}</span>
            <span>{formatUSD(fees)}</span>
            <span className="quote-table__total">
              {formatUSD(q.finalTotal)}
            </span>
            <span>{q.eta ?? "—"}</span>
            <span>
              <a
                href={platformOpenUrl(q)}
                target="_blank"
                rel="noreferrer noopener"
                className="btn btn--link"
              >
                Open
              </a>
            </span>
            {q.status !== "success" && q.warnings.length > 0 ? (
              <div className="quote-table__warning" title={q.warnings.join("\n")}>
                {truncateForDisplay(q.warnings[0], 120)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function sumFees(q: PlatformQuote): number | null {
  const parts = [q.deliveryFee, q.serviceFee, q.smallOrderFee, q.tax];
  if (parts.every((v) => v == null) && q.discount == null) return null;
  const total =
    (q.deliveryFee ?? 0) +
    (q.serviceFee ?? 0) +
    (q.smallOrderFee ?? 0) +
    (q.tax ?? 0) -
    (q.discount ?? 0);
  return total;
}
