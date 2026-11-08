import { describe, expect, it } from "vitest";
import type { DirectoryListing } from "@shared/directory/types";
import { profileHref, websiteHref, withMetfixReferral } from "./listing-links";

const base: DirectoryListing = {
  id: "gym:1",
  kind: "gym",
  name: "MetFix Alpha",
  title: "MetFix Affiliate",
  lat: 1,
  lng: 2,
  city: "Newington",
  state: "CT",
  address: "193 Pascone Place",
  communities: [],
};

describe("listing-links", () => {
  it("opens on-site profile paths", () => {
    expect(profileHref({ ...base, profileUrl: "/affiliates/51/metfix-alpha" })).toBe(
      "/affiliates/51/metfix-alpha",
    );
  });

  it("passes through brokenscience.org profile URLs", () => {
    expect(
      profileHref({
        ...base,
        profileUrl: "https://brokenscience.org/affiliates/51/metfix-alpha",
      }),
    ).toBe("https://brokenscience.org/affiliates/51/metfix-alpha");
  });

  it("adds MetFix UTM params to external websites", () => {
    expect(websiteHref({ ...base, website: "https://www.pskcstrong.com/about" })).toBe(
      "https://www.pskcstrong.com/about?utm_source=metfix&utm_medium=referral&utm_campaign=find-a-gym",
    );
  });

  it("does not duplicate UTM on metfix.org destinations", () => {
    expect(withMetfixReferral("https://metfix.org/affiliates/1/x")).toBe(
      "https://metfix.org/affiliates/1/x",
    );
  });
});
