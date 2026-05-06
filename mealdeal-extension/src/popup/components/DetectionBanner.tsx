type Props = {
  kind: "unsupported" | "error";
  message?: string;
  onManual: () => void;
};

export default function DetectionBanner({ kind, message, onManual }: Props) {
  return (
    <div className={`detection-banner detection-banner--${kind}`}>
      <div className="detection-banner__title">
        {kind === "unsupported"
          ? "Open a delivery site to auto-detect your cart"
          : "We couldn't read this page"}
      </div>
      <div className="detection-banner__message">
        {kind === "unsupported"
          ? "Go to Uber Eats, DoorDash, or Grubhub with an item in your cart, then reopen MealDeal."
          : (message ?? "Try reloading the tab.")}
      </div>
      <button className="btn btn--secondary" onClick={onManual}>
        Enter details manually
      </button>
    </div>
  );
}
