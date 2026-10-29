/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router, Route } from "wouter";
import { clearAccountCache } from "@/lib/account";
import MemberProfilePage from "./MemberProfilePage";
import { jsonResponse } from "../../../test/account/testFixtures";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => {},
}));

vi.mock("@/pages/NotFound", () => ({
  default: () => <div>Not Found</div>,
}));

beforeEach(() => {
  clearAccountCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/members/42")) {
        return jsonResponse({
          member_id: 42,
          display_name: "Member",
          bio: "Hello world",
          location: "Austin",
          badges: { medical: true, affiliate: true, foundations_coach: true },
        });
      }
      if (url.includes("/api/members/")) {
        return jsonResponse({ error: "not_found" }, 404);
      }
      return jsonResponse({ error: "not_found" }, 404);
    }),
  );
});

afterEach(() => {
  cleanup();
  clearAccountCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MemberProfilePage (P-DB-14)", () => {
  it("renders structured badges for /members/42", async () => {
    window.history.pushState({}, "", "/members/42");
    render(
      <Router>
        <Route path="/members/:memberId" component={MemberProfilePage} />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Member")).toBeTruthy());
    expect(screen.getByText("Foundations Coach")).toBeTruthy();
    expect(screen.getByText("Affiliate")).toBeTruthy();
    expect(screen.getByText("Medical Society")).toBeTruthy();
    expect(screen.getByText("Hello world")).toBeTruthy();
    expect(screen.getByText("Austin")).toBeTruthy();
  });

  it("shows NotFound for non-positive member ids", async () => {
    window.history.pushState({}, "", "/members/abc");
    render(
      <Router>
        <Route path="/members/:memberId" component={MemberProfilePage} />
      </Router>,
    );
    await waitFor(() => expect(screen.getByText("Not Found")).toBeTruthy());
  });

  it("has zero raw HTML injection helpers in member/account pages", () => {
    // Split the forbidden identifier so this test file does not contain it verbatim.
    const forbidden = ["dangerously", "SetInnerHTML"].join("");
    const memberSrc = readFileSync(path.join(import.meta.dirname, "MemberProfilePage.tsx"), "utf8");
    expect(memberSrc.includes(forbidden)).toBe(false);
    const accountDir = path.join(import.meta.dirname, "../account");
    const files = [
      "AccountOverview.tsx",
      "AccountBilling.tsx",
      "AccountCourses.tsx",
      "AccountProfile.tsx",
      "DashboardLayout.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(path.join(accountDir, f), "utf8");
      expect(src.includes(forbidden)).toBe(false);
      expect(src).not.toMatch(/emilydesigns/i);
    }
  });
});
