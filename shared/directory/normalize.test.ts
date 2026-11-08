import { describe, expect, it } from "vitest";
import { normalizeDirectoryRow } from "./normalize";

describe("normalizeDirectoryRow", () => {
  it("maps a gym pin and WorkWith labels", () => {
    const listing = normalizeDirectoryRow(
      {
        affiliate_id: 44,
        affiliate_name: "MetFix JAX",
        lat: "30.3",
        lng: -81.6,
        city: "Jacksonville",
        state_abbr: "FL",
        full_addr: "1 Main St",
        website: "https://example.com",
        affiliate_profile_url: "/affiliates/44/metfix-jax",
        communities_served: [{ label: "First Responders", value: 2 }, "Youth"],
      },
      "gym",
    );
    expect(listing).toMatchObject({
      id: "gym:44",
      kind: "gym",
      name: "MetFix JAX",
      city: "Jacksonville",
      state: "FL",
      website: "https://example.com",
      profileUrl: "/affiliates/44/metfix-jax",
      communities: ["First Responders", "Youth"],
    });
  });

  it("maps brokenscience affiliate URLs onto the metfix.org affiliate skin", () => {
    const listing = normalizeDirectoryRow(
      {
        affiliate_id: 52,
        affiliate_name: "BSI Staff",
        lat: 40,
        lng: -70,
        affiliate_profile_url: "https://brokenscience.org/affiliates/52/bsi-staff",
      },
      "gym",
    );
    expect(listing?.profileUrl).toBe("/affiliates/52/bsi-staff");
  });

  it("sends clinic pins to the clinic profile", () => {
    const listing = normalizeDirectoryRow(
      {
        affiliate_id: 9,
        affiliate_name: "Front Range",
        lat: 39.7,
        lng: -104.9,
        affiliate_profile_url: "/affiliates/9/front-range",
      },
      "doctor",
    );
    expect(listing?.profileUrl).toBe("/clinics/9/front-range");
  });

  it("drops pins without coordinates", () => {
    expect(normalizeDirectoryRow({ affiliate_id: 1, affiliate_name: "Nope", lat: 0, lng: 0 }, "gym")).toBeNull();
  });
});
