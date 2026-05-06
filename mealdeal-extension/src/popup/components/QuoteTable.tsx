import type { Platform, PlatformQuote } from "../../lib/types";
import { formatUSD } from "../../lib/formatMoney";
import { platformLabel, platformOpenUrl } from "../../lib/platformLinks";
import { sanitizeRestaurantName, truncateForDisplay } from "../../lib/cleanText";
import { filterUserFacingWarnings } from "../../lib/warnings";

type Props = {
  quotes: PlatformQuote[];
  bestPlatform: Platform | null;
};

export default function QuoteTable({ quotes, bestPlatform }: Props) {
  if (quotes.length === 0) return null;

  // "Cart subtotal" is the primary axis, but fall back to finalTotal when
  // the Actor only captured the checkout total for a platform — otherwise
  // the row shows "—" even though we do have a price.
  const primaryValue = (q: PlatformQuote): number | null =>
    typeof q.itemSubtotal === "number"
      ? q.itemSubtotal
      : typeof q.finalTotal === "number"
        ? q.finalTotal
        : null;

  // Show the Fees column only when at least one quote has fee data.
  const anyFees = quotes.some((q) => sumFees(q) !== null);

  // Show the Total column only when:
  //  - at least one quote has a finalTotal, AND
  //  - at least one quote shows a different subtotal vs finalTotal
  // Otherwise finalTotal is already being shown in the primary column.
  const anyDistinctTotal = quotes.some(
    (q) =>
      typeof q.finalTotal === "number" &&
      typeof q.itemSubtotal === "number" &&
      q.finalTotal !== q.itemSubtotal,
  );

  return (
    <div className="quote-table">
      <div
        className={[
          "quote-table__header",
          anyDistinctTotal ? "" : "quote-table__row--no-total",
          anyFees ? "" : "quote-table__row--no-fees",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span>Platform</span>
        <span>Cart subtotal</span>
        {anyFees ? <span>Fees</span> : null}
        {anyDistinctTotal ? <span>Total</span> : null}
        <span>ETA</span>
        <span />
      </div>
      {quotes.map((q) => {
        const fees = sumFees(q);
        const isBest = q.platform === bestPlatform;
        const restaurantSafe = sanitizeRestaurantName(q.restaurantName);
        const restaurant = truncateForDisplay(restaurantSafe, 40);
        const promo = truncateForDisplay(q.promoText, 60);
        const quoteWarnings = filterUserFacingWarnings(q.warnings);
        return (
          <div
            key={q.platform}
            className={[
              "quote-table__row",
              isBest ? "quote-table__row--best" : "",
              q.status === "failed" ? "quote-table__row--failed" : "",
              anyDistinctTotal ? "" : "quote-table__row--no-total",
              anyFees ? "" : "quote-table__row--no-fees",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>
              <strong>{platformLabel(q.platform)}</strong>
              {restaurant ? (
                <small className="muted" title={restaurantSafe ?? ""}>
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
            <span className="quote-table__subtotal">
              {formatUSD(primaryValue(q))}
            </span>
            {anyFees ? <span>{formatUSD(fees)}</span> : null}
            {anyDistinctTotal ? (
              <span className="quote-table__total">
                {formatUSD(q.finalTotal)}
              </span>
            ) : null}
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
            {q.status === "failed" && quoteWarnings.length > 0 ? (
              <div
                className="quote-table__warning"
                title={quoteWarnings.join("\n")}
              >
                {truncateForDisplay(quoteWarnings[0], 120)}
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
  return (
    (q.deliveryFee ?? 0) +
    (q.serviceFee ?? 0) +
    (q.smallOrderFee ?? 0) +
    (q.tax ?? 0) -
    (q.discount ?? 0)
  );
}
