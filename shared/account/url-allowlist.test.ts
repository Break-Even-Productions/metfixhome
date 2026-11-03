import { describe, expect, it } from "vitest";
import { BEP_WHOP_COMPANY_ID } from "./whop";
import { isWhopCheckoutUrl, sanitizeExternalBillingUrl } from "./url-allowlist";

describe("isWhopCheckoutUrl (CR-CO-1 / CL-RET-1)", () => {
  it("accepts whop.com and *.whop.com https", () => {
    expect(isWhopCheckoutUrl("https://whop.com/checkout/x")).toBe(true);
    expect(isWhopCheckoutUrl("https://pay.whop.com/checkout/x")).toBe(true);
  });

  it("CL-T2 rejects hostile URLs", () => {
    for (const evil of [
      "https://evil.example",
      "https://whop.com.evil.com",
      "http://whop.com",
      "https://u@whop.com",
      "javascript:alert(1)",
      "https://whop.com:8443/x",
      "https://evilwhop.com",
    ]) {
      expect(isWhopCheckoutUrl(evil), evil).toBe(false);
    }
  });
});

describe("sanitizeExternalBillingUrl (DP-WHOP-1 / T19)", () => {
  it("allows whop.com and *.whop.com in whop_only mode", () => {
    expect(sanitizeExternalBillingUrl("https://whop.com/checkout/abc", "whop_only")).toBe(
      "https://whop.com/checkout/abc",
    );
    expect(
      sanitizeExternalBillingUrl("https://pay.whop.com/checkout/abc", "whop_only"),
    ).toBe("https://pay.whop.com/checkout/abc");
  });

  it("rejects suffix tricks like whop.com.evil.io (not endsWith alone)", () => {
    expect(
      sanitizeExternalBillingUrl("https://whop.com.evil.io/checkout", "whop_only"),
    ).toBeNull();
    expect(
      sanitizeExternalBillingUrl("https://notwhop.com/x", "whop_only"),
    ).toBeNull();
    expect(
      sanitizeExternalBillingUrl("https://evilwhop.com/x", "whop_only"),
    ).toBeNull();
  });

  it("rejects Curie substring anywhere in the href", () => {
    expect(
      sanitizeExternalBillingUrl("https://whop.com/checkout/curie-plan", "whop_only"),
    ).toBeNull();
    expect(
      sanitizeExternalBillingUrl("https://whop.com/checkout/Curie", "whop_only"),
    ).toBeNull();
  });

  it("pins Break Even Productions biz id; rejects foreign biz_", () => {
    expect(
      sanitizeExternalBillingUrl(
        `https://whop.com/${BEP_WHOP_COMPANY_ID}/checkout/x`,
        "whop_only",
      ),
    ).toBe(`https://whop.com/${BEP_WHOP_COMPANY_ID}/checkout/x`);
    expect(
      sanitizeExternalBillingUrl("https://whop.com/biz_FOREIGN123/checkout/x", "whop_only"),
    ).toBeNull();
  });

  it("billing_portal allows Stripe hosts; whop_only does not", () => {
    expect(
      sanitizeExternalBillingUrl("https://billing.stripe.com/session/x", "billing_portal"),
    ).toBe("https://billing.stripe.com/session/x");
    expect(
      sanitizeExternalBillingUrl("https://checkout.stripe.com/c/pay/x", "billing_portal"),
    ).toBe("https://checkout.stripe.com/c/pay/x");
    expect(
      sanitizeExternalBillingUrl("https://billing.stripe.com/session/x", "whop_only"),
    ).toBeNull();
  });

  it("rejects non-https, credentials, empty, and overlong urls", () => {
    expect(sanitizeExternalBillingUrl("http://whop.com/x", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl("https://user:pass@whop.com/x", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl("", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl("not a url", "whop_only")).toBeNull();
    expect(sanitizeExternalBillingUrl(`https://whop.com/${"a".repeat(2100)}`, "whop_only")).toBeNull();
  });

  it("R3-N2: rejects non-default https ports", () => {
    expect(sanitizeExternalBillingUrl("https://whop.com:8443/checkout/x", "whop_only")).toBeNull();
    expect(
      sanitizeExternalBillingUrl("https://billing.stripe.com:8443/session/x", "billing_portal"),
    ).toBeNull();
  });
});
