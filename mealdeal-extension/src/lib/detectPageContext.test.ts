import { describe, expect, it } from "vitest";
import { platformForUrl } from "./detectPageContext";

describe("platformForUrl", () => {
  it("maps Uber Eats hostnames", () => {
    expect(platformForUrl("https://www.ubereats.com/store/thai-time")).toBe(
      "ubereats",
    );
    expect(platformForUrl("https://ubereats.com/")).toBe("ubereats");
  });

  it("maps DoorDash hostnames", () => {
    expect(platformForUrl("https://www.doordash.com/store/123")).toBe(
      "doordash",
    );
  });

  it("maps Grubhub hostnames", () => {
    expect(platformForUrl("https://www.grubhub.com/restaurant/x")).toBe(
      "grubhub",
    );
  });

  it("returns null for other sites", () => {
    expect(platformForUrl("https://example.com/")).toBeNull();
    expect(platformForUrl("https://www.postmates.com/")).toBeNull();
  });

  it("returns null for undefined or invalid URLs", () => {
    expect(platformForUrl(undefined)).toBeNull();
    expect(platformForUrl("not a url")).toBeNull();
  });
});
