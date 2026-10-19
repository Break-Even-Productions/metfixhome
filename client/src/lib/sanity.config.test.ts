import { afterEach, describe, expect, it, vi } from "vitest";

describe("sanity client config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("reads published documents from the public CDN without a token", async () => {
    const { sanityClient } = await import("./sanity");
    expect(sanityClient).not.toBeNull();
    if (!sanityClient) return;

    const cfg = sanityClient.config();
    expect(cfg.token).toBeUndefined();
    expect("token" in cfg && cfg.token).toBeFalsy();
    expect(cfg.perspective).toBe("published");
    expect(cfg.useCdn).toBe(true);
    expect(cfg.projectId).toBe("etg9lezr");
    expect(cfg.dataset).toBe("production");
    expect(cfg.apiVersion).toBe("2025-01-01");
    // getUrl defaults canUseCdn to false; pass the configured flag so this
    // checks the host queries actually use.
    expect(
      new URL(
        sanityClient.getUrl(sanityClient.getDataUrl("query", "production"), cfg.useCdn),
      ).host,
    ).toBe("etg9lezr.apicdn.sanity.io");
  });

  it("ignores a read token supplied only through the environment", async () => {
    const dummy = `skTEST${"A".repeat(60)}`;
    vi.stubEnv("VITE_SANITY_API_READ_TOKEN", dummy);
    vi.resetModules();
    const { sanityClient } = await import("./sanity");
    expect(sanityClient).not.toBeNull();
    if (!sanityClient) return;
    expect(sanityClient.config().token).toBeUndefined();
  });
});
