import { useEffect, useState } from "react";
import type {
  CartItemRequest,
  MealDealRequest,
  Platform,
} from "../../lib/types";
import { PLATFORMS } from "../../lib/types";
import { platformLabel } from "../../lib/platformLinks";
import { loadHomeAddress, saveHomeAddress } from "../../lib/storage";

type Props = {
  initialValues?: Partial<MealDealRequest>;
  submitting: boolean;
  onSubmit: (req: MealDealRequest) => void;
};

type CartItemDraft = { name: string; quantity: string };

function toCartItems(drafts: CartItemDraft[]): CartItemRequest[] {
  return drafts
    .filter((d) => d.name.trim().length > 0)
    .map((d) => ({
      name: d.name.trim(),
      quantity: Math.max(1, parseInt(d.quantity, 10) || 1),
    }));
}

export default function SearchForm({
  initialValues,
  submitting,
  onSubmit,
}: Props) {
  const [address, setAddress] = useState(initialValues?.address ?? "");
  const [restaurantName, setRestaurantName] = useState(
    initialValues?.restaurantName ?? "",
  );
  const [query, setQuery] = useState(initialValues?.query ?? "");
  const [items, setItems] = useState<CartItemDraft[]>(
    initialValues?.cartItems?.length
      ? initialValues.cartItems.map((i) => ({
          name: i.name,
          quantity: String(i.quantity),
        }))
      : [{ name: "", quantity: "1" }],
  );
  const [platforms, setPlatforms] = useState<Platform[]>(
    initialValues?.platforms?.length
      ? initialValues.platforms
      : [...PLATFORMS],
  );
  const [saveAsHome, setSaveAsHome] = useState(true);
  const [homeAddress, setHomeAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On mount, seed the address field with the user's saved home address if
  // the caller didn't pass one in.
  useEffect(() => {
    (async () => {
      const home = await loadHomeAddress();
      setHomeAddress(home);
      if (!address && home) setAddress(home);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePlatform(p: Platform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function updateItem(index: number, patch: Partial<CartItemDraft>) {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addItemRow() {
    setItems((prev) => [...prev, { name: "", quantity: "1" }]);
  }

  function removeItemRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUseHome() {
    if (homeAddress) setAddress(homeAddress);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cartItems = toCartItems(items);
    if (!address.trim()) {
      setError("Delivery address is required.");
      return;
    }
    if (!query.trim() && !restaurantName.trim()) {
      setError("Enter a restaurant name or a food query.");
      return;
    }
    if (cartItems.length === 0) {
      setError("Add at least one cart item.");
      return;
    }
    if (platforms.length === 0) {
      setError("Select at least one platform.");
      return;
    }
    setError(null);

    if (saveAsHome && address.trim() !== (homeAddress ?? "")) {
      await saveHomeAddress(address.trim());
      setHomeAddress(address.trim());
    }

    onSubmit({
      address: address.trim(),
      restaurantName: restaurantName.trim() || undefined,
      query: query.trim() || restaurantName.trim(),
      cartItems,
      platforms,
    });
  }

  const addressIsHome = !!homeAddress && address.trim() === homeAddress.trim();

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Delivery address</span>
        <div className="address-input">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="525 Market St, San Francisco, CA"
            autoFocus
          />
          {homeAddress && !addressIsHome ? (
            <div className="address-actions">
              <button
                type="button"
                className="btn btn--link"
                onClick={handleUseHome}
                title={homeAddress}
              >
                🏠 Use home address
              </button>
            </div>
          ) : null}
          <label className="address-save">
            <input
              type="checkbox"
              checked={saveAsHome}
              onChange={(e) => setSaveAsHome(e.target.checked)}
            />
            <span>Save as my home address</span>
          </label>
        </div>
      </label>

      <label className="field">
        <span>Restaurant name (optional)</span>
        <input
          type="text"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          placeholder="Thai Time"
        />
      </label>

      <label className="field">
        <span>Food query</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chicken Pad Thai"
        />
      </label>

      <fieldset className="cart-items">
        <legend>Cart items</legend>
        {items.map((item, i) => (
          <div className="cart-items__row" key={i}>
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateItem(i, { name: e.target.value })}
              placeholder="Chicken Pad Thai"
            />
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => updateItem(i, { quantity: e.target.value })}
            />
            {items.length > 1 ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => removeItemRow(i)}
                aria-label="Remove item"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="btn btn--ghost" onClick={addItemRow}>
          + Add item
        </button>
      </fieldset>

      <fieldset className="platforms">
        <legend>Compare</legend>
        {PLATFORMS.map((p) => (
          <label key={p} className="platforms__option">
            <input
              type="checkbox"
              checked={platforms.includes(p)}
              onChange={() => togglePlatform(p)}
            />
            <span>{platformLabel(p)}</span>
          </label>
        ))}
      </fieldset>

      {error ? <div className="form-error">{error}</div> : null}

      <button type="submit" className="btn btn--primary" disabled={submitting}>
        {submitting ? "Running…" : "Find the cheapest"}
      </button>
    </form>
  );
}
