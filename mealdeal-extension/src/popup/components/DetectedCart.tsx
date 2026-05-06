import { useEffect, useState } from "react";
import type { PageContext, Platform } from "../../lib/types";
import { platformLabel } from "../../lib/platformLinks";
import { formatUSD } from "../../lib/formatMoney";
import { sanitizeRestaurantName } from "../../lib/cleanText";
import { loadHomeAddress, saveHomeAddress } from "../../lib/storage";

type Props = {
  context: PageContext;
  source?: "live" | "cache";
  updatedAt?: number;
  submitting: boolean;
  onCompare: (platforms: Platform[], overrideAddress?: string) => void;
  onEditManually: () => void;
};

const ALL_PLATFORMS: Platform[] = ["ubereats", "doordash", "grubhub"];

function formatRelative(updatedAt: number | undefined): string {
  if (!updatedAt) return "";
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export default function DetectedCart({
  context,
  source = "live",
  updatedAt,
  submitting,
  onCompare,
  onEditManually,
}: Props) {
  const otherPlatforms = ALL_PLATFORMS.filter((p) => p !== context.platform);
  const hasItems = context.cartItems.length > 0;

  const [addressOverride, setAddressOverride] = useState<string | null>(null);
  const [homeAddress, setHomeAddress] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState("");

  useEffect(() => {
    loadHomeAddress().then((home) => {
      setHomeAddress(home);
      // If the page didn't expose an address, auto-use the saved home.
      if (home && !context.address && !addressOverride) {
        setAddressOverride(home);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.address]);

  const effectiveAddress = addressOverride ?? context.address ?? null;
  const hasAddress = !!effectiveAddress;
  const canCompare = hasItems && hasAddress && !submitting;

  const compareLabel = submitting
    ? "Comparing…"
    : `Compare with ${otherPlatforms.map((p) => platformLabel(p)).join(" & ")}`;

  async function handleSaveAddress() {
    const value = addressDraft.trim();
    if (!value) return;
    setAddressOverride(value);
    await saveHomeAddress(value);
    setHomeAddress(value);
    setEditingAddress(false);
  }

  function startEditing() {
    setAddressDraft(effectiveAddress ?? "");
    setEditingAddress(true);
  }

  function handleCompare() {
    onCompare(otherPlatforms, effectiveAddress ?? undefined);
  }

  return (
    <section className="detected-cart">
      <div className="detected-cart__eyebrow">
        {source === "cache" ? (
          <>
            Last seen on {platformLabel(context.platform)}
            <span className="detected-cart__stale">
              {" "}
              · {formatRelative(updatedAt)}
            </span>
          </>
        ) : (
          <>Detected on {platformLabel(context.platform)}</>
        )}
      </div>

      <div className="detected-cart__restaurant">
        {sanitizeRestaurantName(context.restaurantName) ?? "Unknown restaurant"}
      </div>

      {editingAddress ? (
        <div className="detected-cart__address-edit">
          <input
            type="text"
            value={addressDraft}
            onChange={(e) => setAddressDraft(e.target.value)}
            placeholder="525 Market St, San Francisco, CA"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveAddress();
              }
              if (e.key === "Escape") setEditingAddress(false);
            }}
          />
          <div className="detected-cart__address-edit-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleSaveAddress}
              disabled={!addressDraft.trim()}
            >
              Save as home
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setEditingAddress(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : hasAddress ? (
        <div
          className="detected-cart__address"
          title={effectiveAddress ?? ""}
        >
          <span className="detected-cart__address-icon" aria-hidden="true">
            📍
          </span>
          <span className="detected-cart__address-text">
            {effectiveAddress}
          </span>
        </div>
      ) : (
        <div className="detected-cart__address detected-cart__address--missing">
          <span className="detected-cart__address-icon" aria-hidden="true">
            📍
          </span>
          <span className="detected-cart__address-text">
            No delivery address found. Enter it once to save it for later.
          </span>
        </div>
      )}

      {!editingAddress ? (
        <div className="detected-cart__address-actions">
          <button
            type="button"
            className="btn btn--link"
            onClick={startEditing}
          >
            ✏️ {hasAddress ? "Change address" : "Enter address"}
          </button>
          {homeAddress && effectiveAddress !== homeAddress ? (
            <button
              type="button"
              className="btn btn--link"
              onClick={() => setAddressOverride(homeAddress)}
              title={homeAddress}
            >
              🏠 Use home address
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="detected-cart__items">
        {hasItems ? (
          context.cartItems.map((item, i) => (
            <li key={`${item.name}-${i}`} className="detected-cart__item">
              <span className="detected-cart__qty">{item.quantity}×</span>
              <span className="detected-cart__name">{item.name}</span>
            </li>
          ))
        ) : (
          <li className="detected-cart__empty">
            No cart items detected on this page.
          </li>
        )}
      </ul>

      {context.snapshot.itemSubtotal != null ||
      context.snapshot.finalTotal != null ? (
        <div className="detected-cart__total">
          <span>
            {context.snapshot.itemSubtotal != null
              ? "Cart subtotal on this platform"
              : "Total on this platform"}
          </span>
          <strong>
            {formatUSD(
              context.snapshot.itemSubtotal ??
                context.snapshot.finalTotal,
            )}
          </strong>
        </div>
      ) : null}

      <div className="detected-cart__actions">
        <button
          className="btn btn--primary"
          disabled={!canCompare}
          onClick={handleCompare}
          title={
            !hasItems
              ? "No cart items detected yet."
              : !hasAddress
                ? "Add an address above to enable Compare."
                : undefined
          }
        >
          {compareLabel}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onEditManually}
          disabled={submitting}
        >
          Edit full search
        </button>
      </div>
    </section>
  );
}
