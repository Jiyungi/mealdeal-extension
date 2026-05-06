import type { Platform, PlatformQuote } from "../../lib/types";
import { formatUSD } from "../../lib/formatMoney";
import { platformLabel, platformOpenUrl } from "../../lib/platformLinks";

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
        const fees =
          (q.deliveryFee ?? 0) +
          (q.serviceFee ?? 0) +
          (q.smallOrderFee ?? 0) +
          (q.tax ?? 0) -
          (q.discount ?? 0);
        const isBest = q.platform === bestPlatform;
        return (
          <div
            key={q.platform}
            className={`quote-table__row${isBest ? " quote-table__row--best" : ""}${
              q.status === "failed" ? " quote-table__row--failed" : ""
            }`}
          >
            <span>
              <strong>{platformLabel(q.platform)}</strong>
              {q.restaurantName ? (
                <small className="muted"> · {q.restaurantName}</small>
              ) : null}
              {q.promoText ? (
                <div className="badge">{q.promoText}</div>
              ) : null}
            </span>
            <span>{formatUSD(q.itemSubtotal)}</span>
            <span>{formatUSD(fees || null)}</span>
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
            {q.status === "failed" && q.warnings.length > 0 ? (
              <div className="quote-table__warning">{q.warnings[0]}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
