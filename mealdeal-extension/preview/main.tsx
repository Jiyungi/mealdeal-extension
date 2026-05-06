import React from "react";
import ReactDOM from "react-dom/client";
import LoadingState from "../src/popup/components/LoadingState";
import ResultCard from "../src/popup/components/ResultCard";
import QuoteTable from "../src/popup/components/QuoteTable";
import DetectedCart from "../src/popup/components/DetectedCart";
import type {
  MealDealResult,
  PageContext,
  Platform,
  PlatformQuote,
} from "../src/lib/types";
import type { PlatformRunStatus } from "../src/popup/components/PlatformStatusCard";
import "../src/popup/styles.css";

function Header() {
  return (
    <header className="app__header">
      <h1>MealDeal</h1>
      <p className="app__tagline">
        Compare the real cost of your cart across Uber Eats, DoorDash, and
        Grubhub.
      </p>
    </header>
  );
}

const detectedContext: PageContext = {
  platform: "ubereats",
  url: "https://www.ubereats.com/store/thai-time",
  address: "525 Market St, San Francisco, CA",
  restaurantName: "Thai Time",
  restaurantUrl: "https://www.ubereats.com/store/thai-time",
  cartItems: [
    { name: "Chicken Pad Thai", quantity: 2 },
    { name: "Thai Iced Tea", quantity: 1 },
    { name: "Spring Rolls (4 pc)", quantity: 1 },
  ],
  snapshot: {
    platform: "ubereats",
    status: "success",
    restaurantName: "Thai Time",
    restaurantUrl: "https://www.ubereats.com/store/thai-time",
    matchedItemName: "Chicken Pad Thai",
    requestedItemName: null,
    matchScore: null,
    itemSubtotal: 38.47,
    deliveryFee: 2.99,
    serviceFee: 3.1,
    smallOrderFee: 0,
    tax: 1.82,
    discount: 5,
    finalTotal: 41.38,
    promoText: "Save $5",
    eta: "25-35 min",
    checkoutUrl: "https://www.ubereats.com/checkout/abc",
    quoteLevel: "pre_checkout",
    confidence: "high",
    warnings: [],
  },
};

function Detected() {
  return (
    <div className="app">
      <Header />
      <DetectedCart
        context={detectedContext}
        submitting={false}
        onCompare={() => {}}
        onEditManually={() => {}}
      />
    </div>
  );
}

function Running() {
  const statuses: Record<Platform, PlatformRunStatus> = {
    ubereats: "success",
    doordash: "running",
    grubhub: "queued",
  };
  return (
    <div className="app">
      <Header />
      <LoadingState
        platforms={["ubereats", "doordash", "grubhub"]}
        statuses={statuses}
      />
    </div>
  );
}

function quote(parts: Partial<PlatformQuote>): PlatformQuote {
  return {
    platform: "ubereats",
    status: "success",
    restaurantName: "Thai Time",
    restaurantUrl: "https://www.ubereats.com/store/thai-time",
    matchedItemName: "Chicken Pad Thai",
    requestedItemName: "Chicken Pad Thai",
    matchScore: 0.94,
    itemSubtotal: 38.47,
    deliveryFee: 2.99,
    serviceFee: 3.1,
    smallOrderFee: 0,
    tax: 1.82,
    discount: 5,
    finalTotal: 41.38,
    promoText: "Save $5",
    eta: "25-35 min",
    checkoutUrl: "https://www.ubereats.com/checkout/abc",
    quoteLevel: "pre_checkout",
    confidence: "high",
    warnings: [],
    ...parts,
  };
}

const mockResult: MealDealResult = {
  input: {
    address: "525 Market St, San Francisco, CA",
    restaurantName: "Thai Time",
    query: "Chicken Pad Thai",
    cartItems: detectedContext.cartItems,
    platforms: ["ubereats", "doordash", "grubhub"],
  },
  bestPlatform: "doordash",
  bestQuote: quote({
    platform: "doordash",
    finalTotal: 37.88,
    itemSubtotal: 36.99,
    deliveryFee: 0,
    serviceFee: 2.64,
    tax: 1.9,
    discount: 3.65,
    promoText: "Free delivery",
    eta: "30-40 min",
    checkoutUrl: "https://www.doordash.com/checkout/def",
    restaurantUrl: "https://www.doordash.com/store/thai-time",
  }),
  quotes: [
    quote({}),
    quote({
      platform: "doordash",
      finalTotal: 37.88,
      itemSubtotal: 36.99,
      deliveryFee: 0,
      serviceFee: 2.64,
      tax: 1.9,
      discount: 3.65,
      promoText: "Free delivery",
      eta: "30-40 min",
      checkoutUrl: "https://www.doordash.com/checkout/def",
      restaurantUrl: "https://www.doordash.com/store/thai-time",
    }),
    quote({
      platform: "grubhub",
      finalTotal: 45.22,
      itemSubtotal: 39.25,
      deliveryFee: 4.99,
      serviceFee: 2.41,
      tax: 2.39,
      discount: 0,
      promoText: null,
      eta: "35-45 min",
      checkoutUrl: null,
      restaurantUrl: "https://www.grubhub.com/restaurant/thai-time",
    }),
  ],
  savingsVsMostExpensive: 7.34,
  savingsVsSecondBest: 3.5,
  reason:
    "DoorDash beats Uber Eats with free delivery on your current cart.",
  warnings: [],
  createdAt: new Date().toISOString(),
};

function Result() {
  return (
    <div className="app">
      <Header />
      <section className="results">
        <ResultCard result={mockResult} />
        <QuoteTable
          quotes={mockResult.quotes}
          bestPlatform={mockResult.bestPlatform}
        />
        <button className="btn btn--ghost">New search</button>
      </section>
    </div>
  );
}

function mount(id: string, node: React.ReactNode) {
  const el = document.getElementById(id);
  if (!el) return;
  ReactDOM.createRoot(el).render(<React.StrictMode>{node}</React.StrictMode>);
}

mount("frame-detected", <Detected />);
mount("frame-running", <Running />);
mount("frame-result", <Result />);
