/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpgradePrompt } from "./UpgradePrompt";
import * as session from "@/lib/session";
import { JoinFlowProvider } from "@/contexts/JoinFlowContext";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UpgradePrompt WJ18 + B5", () => {
  it("signed out → click Start my free month opens JoinFlow", async () => {
    vi.spyOn(session, "peekMe").mockReturnValue({ status: "signed_out" });
    vi.spyOn(session, "loadMe").mockResolvedValue({ status: "signed_out" });
    render(
      <JoinFlowProvider>
        <UpgradePrompt />
      </JoinFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Start my free month/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /Join MetFix/i })).toBeTruthy();
    });
  });

  it("signed in → Manage membership navigates to /account/billing", async () => {
    vi.spyOn(session, "peekMe").mockReturnValue({
      status: "signed_in",
      public_name: "Pat",
      moderator: false,
    });
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat",
      moderator: false,
    });
    render(<UpgradePrompt />);
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Manage membership/i });
      expect(link.getAttribute("href")).toBe("/account/billing");
    });
  });
});
