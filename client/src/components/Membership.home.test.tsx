/**
 * @vitest-environment jsdom
 * WJ20: render Home and assert Membership is mounted (behavior, not source regex).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_HERO } from "@shared/join";
import { JoinFlowProvider } from "@/contexts/JoinFlowContext";
import { Membership } from "./Membership";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WJ20 Membership surfaces (render)", () => {
  it("Membership surface renders hero + CTA", () => {
    const onJoin = vi.fn();
    render(<Membership onJoin={onJoin} />);
    expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start my free month/i })).toBeTruthy();
  });

  it("Home mounts Membership in #membership-section", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const { default: Home } = await import("@/pages/Home");
    render(
      <JoinFlowProvider>
        <Home />
      </JoinFlowProvider>,
    );
    await waitFor(() => {
      const section = document.getElementById("membership-section");
      expect(section).toBeTruthy();
      expect(section!.querySelector("#membership")).toBeTruthy();
      expect(screen.getByText(MEMBERSHIP_HERO.headline)).toBeTruthy();
    });
  });
});
