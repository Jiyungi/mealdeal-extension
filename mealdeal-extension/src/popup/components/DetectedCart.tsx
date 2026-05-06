import type { PageContext, Platform } from "../../lib/types";
import { platformLabel } from "../../lib/platformLinks";
import { formatUSD } from "../../lib/formatMoney";

type Props = {
  context: PageContext;
  submitting: boolean;
  onCompare: (platforms: Platform[]) => void;
  onEditManually: () => void;
};

const ALL_PLATFORMS: Platform[] = ["ubereats", "doordash", "grubhub"];

export default function DetectedCart({
  context,
  submitting,
  onCompare,
  onEditManually,
}: Props) {
  const otherPlatforms = ALL_PLATFORMS.filter((p) => p !== context.platform);
  const canCompare = context.cartItems.length > 0 && !!context.address;

  return (
    <section className="detected-cart">
      <div className="detected-cart__eyebrow">
        Detected on {platformLabel(context.platform)}
      </div>

      <div className="detected-cart__restaurant">
        {context.restaurantName ?? "Unknown restaurant"}
      </div>

      {context.address ? (
        <div className="detected-cart__address" title={context.address}>
          📍 {context.address}
        </div>
      ) : (
        <div className="detected-cart__address detected-cart__address--missing">
          📍 No delivery address detected
        </div>
      )}

      <ul className="detected-cart__items">
        {context.cartItems.length === 0 ? (
          <li className="detected-cart__empty">
            No cart items detected on this page.
          </li>
        ) : (
          context.cartItems.map((item, i) => (
            <li key={`${item.name}-${i}`} className="detected-cart__item">
              <span className="detected-cart__qty">{item.quantity}×</span>
              <span className="detected-cart__name">{item.name}</span>
            </li>
          ))
        )}
      </ul>

      {context.snapshot.finalTotal != null ? (
        <div className="detected-cart__total">
          <span>Total on this platform</span>
          <strong>{formatUSD(context.snapshot.finalTotal)}</strong>
        </div>
      ) : null}

      <div className="detected-cart__actions">
        <button
          className="btn btn--primary"
          disabled={!canCompare || submitting}
          onClick={() => onCompare(otherPlatforms)}
        >
          {submitting
            ? "Comparing…"
            : `Compare with ${otherPlatforms
                .map((p) => platformLabel(p))
                .join(" & ")}`}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onEditManually}
          disabled={submitting}
        >
          Edit manually
        </button>
      </div>
    </section>
  );
}
