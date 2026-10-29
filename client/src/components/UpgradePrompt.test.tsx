/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpgradePrompt } from "./UpgradePrompt";
import * as session from "@/lib/session";
import { JoinFlowProvider } from "@/contexts/JoinFlowContext";
import { readFileSync } from "node:fs";
import { join } from "node:path";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("UpgradePrompt WJ18 + B5", () => {
  it("signed out → Start my free month (opens JoinFlow when provider present)", async () => {
    vi.spyOn(session, "peekMe").mockReturnValue({ status: "signed_out" });
    vi.spyOn(session, "loadMe").mockResolvedValue({ status: "signed_out" });
    render(
      <JoinFlowProvider>
        <UpgradePrompt />
      </JoinFlowProvider>,
    );
    expect(screen.getByTestId("upgrade-prompt")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start my free month/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Manage membership/i })).toBeNull();
  });

  it("signed in → Manage membership links to /account/billing", async () => {
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

describe("WJ18 locked surfaces + B6 (unlocked doubles only)", () => {
  it("PostDetailPage keeps exactly one UpgradePrompt", () => {
    const src = readFileSync(
      join(process.cwd(), "client/src/pages/posts/PostDetailPage.tsx"),
      "utf8",
    );
    expect(src).toMatch(/import\s*\{[^}]*UpgradePrompt/);
    expect(src.match(/<UpgradePrompt/g)?.length ?? 0).toBe(1);
  });

  it("Classes keeps exactly one UpgradePrompt", () => {
    const src = readFileSync(join(process.cwd(), "client/src/pages/Classes.tsx"), "utf8");
    expect(src).toMatch(/import\s*\{[^}]*UpgradePrompt/);
    expect(src.match(/<UpgradePrompt/g)?.length ?? 0).toBe(1);
  });

  it("LibraryDetailPage has exactly one UpgradePrompt (no locked stub double)", () => {
    const src = readFileSync(
      join(process.cwd(), "client/src/pages/library/LibraryDetailPage.tsx"),
      "utf8",
    );
    expect(src.match(/<UpgradePrompt/g)?.length ?? 0).toBe(1);
  });
});
