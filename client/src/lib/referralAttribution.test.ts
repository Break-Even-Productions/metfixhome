import { describe, expect, it } from "vitest";
import { captureBsiRef, readBsiRef } from "./referralAttribution";
import { MFX_BSI_REF_KEY } from "../../../shared/account/courseReferrals";

function memStorage(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    map,
  };
}

describe("referralAttribution (CR4 / CR-COALESCE-2)", () => {
  it("captures valid bsi_ref and strips from URL", () => {
    const s = memStorage();
    const replaced: string[] = [];
    const out = captureBsiRef("?bsi_ref=cfexample9&x=1", s, (u) => replaced.push(u));
    expect(out).toBe("cfexample9");
    expect(s.getItem(MFX_BSI_REF_KEY)).toBe("cfexample9");
    expect(replaced.length).toBe(1);
  });

  it("rejects invalid values and does not store", () => {
    for (const bad of ["a", "x".repeat(65), "x y", "<script>", "' OR 1=1"]) {
      const s = memStorage();
      captureBsiRef(`?bsi_ref=${encodeURIComponent(bad)}`, s, () => {});
      expect(s.getItem(MFX_BSI_REF_KEY)).toBeNull();
    }
  });

  it("drops tampered stored value on read", () => {
    const s = memStorage({ [MFX_BSI_REF_KEY]: "bad value" });
    expect(readBsiRef(s)).toBeNull();
    expect(s.getItem(MFX_BSI_REF_KEY)).toBeNull();
  });

  it("only key is mfx_bsi_ref", () => {
    const s = memStorage();
    captureBsiRef("?bsi_ref=okslug01", s, () => {});
    expect([...s.map.keys()]).toEqual([MFX_BSI_REF_KEY]);
  });
});
