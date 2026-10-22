/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityPanel } from "./CommunityPanel";
import * as leaderboardApi from "./leaderboard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  leaderboardApi.invalidateLeaderboardCache();
});

const baseProps = {
  load: { status: "loaded" as const, comments: [] },
  pillar: "body" as const,
  dateIso: "2025-02-10",
  viewerDisplayName: "Pat",
  signedIn: true,
};

describe("CommunityPanel", () => {
  it("keeps Comments only when the leaderboard has no entries", async () => {
    vi.spyOn(leaderboardApi, "fetchDailyFixLeaderboard").mockResolvedValue({
      status: "loaded",
      rows: [],
    });

    render(<CommunityPanel {...baseProps} />);

    expect(screen.getByRole("heading", { name: /^Comments$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Community view/i })).toBeNull();
    await waitFor(() =>
      expect(leaderboardApi.fetchDailyFixLeaderboard).toHaveBeenCalled(),
    );
    expect(screen.queryByRole("button", { name: /Community view/i })).toBeNull();
  });

  it("offers a Comments/Leaderboard caret when entries exist", async () => {
    vi.spyOn(leaderboardApi, "fetchDailyFixLeaderboard").mockResolvedValue({
      status: "loaded",
      rows: [
        {
          rank: 1,
          public_name: "Ada",
          score_value: 10,
          scaling_mode: "rx",
          logged_at: "t",
          is_self: false,
        },
      ],
    });

    render(<CommunityPanel {...baseProps} />);

    const trigger = await screen.findByRole("button", { name: /Community view/i });
    expect(trigger.textContent).toMatch(/Comments/i);

    fireEvent.keyDown(trigger, { key: "Enter" });
    const leaderboardItem = await screen.findByRole("menuitemradio", {
      name: /Leaderboard/i,
    });
    fireEvent.click(leaderboardItem);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Community view/i }).textContent).toMatch(
        /Leaderboard/i,
      ),
    );
    expect(screen.getByLabelText(/body leaderboard/i)).toBeTruthy();
  });

  it("hides the caret when signed out", async () => {
    const spy = vi.spyOn(leaderboardApi, "fetchDailyFixLeaderboard");
    render(
      <CommunityPanel
        {...baseProps}
        signedIn={false}
        viewerDisplayName={null}
      />,
    );
    expect(screen.getByRole("heading", { name: /^Comments$/i })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });
});
