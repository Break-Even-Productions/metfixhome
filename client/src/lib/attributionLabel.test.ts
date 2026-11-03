import { describe, expect, it } from "vitest";
import { friendlyAttributionLabel } from "./attributionLabel";

describe("friendlyAttributionLabel (N7)", () => {
  it("maps the four wire sources to friendly copy", () => {
    expect(friendlyAttributionLabel("primary_org")).toBe("Your primary organization");
    expect(friendlyAttributionLabel("explicit_slug")).toBe("Referral link you entered");
    expect(friendlyAttributionLabel("bsi_ref_cookie")).toBe(
      "Saved referral from this browser",
    );
    expect(friendlyAttributionLabel("none")).toBe("No referral attribution");
  });

  it("passes through unknown sources unchanged", () => {
    expect(friendlyAttributionLabel("client_override")).toBe("client_override");
  });
});
