import { describe, expect, it } from "vitest";
import type { DirectoryListing } from "@shared/directory/types";
import { filterDirectory, listingInBounds } from "./filter";

const austin: DirectoryListing = {
  id: "gym:1",
  kind: "gym",
  name: "North Loop",
  title: "MetFix Affiliate",
  lat: 30.27,
  lng: -97.74,
  city: "Austin",
  state: "TX",
  address: "1 Congress",
  communities: ["Athletes"],
};

const seattle: DirectoryListing = {
  id: "coach:2",
  kind: "coach",
  name: "Elena Voss",
  title: "MetFix Coach",
  lat: 47.6,
  lng: -122.3,
  city: "Seattle",
  state: "WA",
  address: "",
  communities: ["Postpartum"],
};

describe("filterDirectory", () => {
  it("keeps listings inside the visible map and the active chips", () => {
    const texas = { north: 36, south: 25, east: -93, west: -107 };
    expect(listingInBounds(austin, texas)).toBe(true);
    expect(listingInBounds(seattle, texas)).toBe(false);
    const visible = filterDirectory([seattle, austin], {
      text: "",
      kind: "all",
      communities: [],
      bounds: texas,
    });
    expect(visible.map((item) => item.id)).toEqual(["gym:1"]);
    const athletes = filterDirectory([austin, seattle], {
      text: "loop",
      kind: "gym",
      communities: ["Athletes"],
      bounds: null,
    });
    expect(athletes).toHaveLength(1);
  });
});
