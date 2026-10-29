/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/GlobalNav", () => ({ default: () => null }));
vi.mock("@/pages/Home", () => ({ default: () => <div>home</div> }));
vi.mock("@/pages/BecomeAnAffiliate", () => ({ default: () => null }));
vi.mock("@/pages/Classes", () => ({ default: () => null }));
vi.mock("@/pages/AffiliateSeminars", () => ({ default: () => null }));
vi.mock("@/pages/Login", () => ({ default: () => null }));
vi.mock("@/pages/the-daily-fix/TheDailyFixPage", () => ({ default: () => null }));
vi.mock("@/pages/posts/PostsPage", () => ({ default: () => null }));
vi.mock("@/pages/library/LibraryPage", () => ({ default: () => null }));
vi.mock("@/pages/account/AccountOverview", () => ({ default: () => null }));
vi.mock("@/pages/account/AccountBilling", () => ({ default: () => null }));
vi.mock("@/pages/account/AccountProfile", () => ({ default: () => null }));
vi.mock("@/pages/account/AccountCourses", () => ({ default: () => null }));
vi.mock("@/pages/account/AccountFavorites", () => ({ default: () => null }));
vi.mock("@/pages/account/AccountReferrals", () => ({ default: () => null }));
vi.mock("@/pages/account/AccountNotifications", () => ({ default: () => null }));
vi.mock("@/pages/account/AccountPrivacy", () => ({ default: () => null }));
vi.mock("@/pages/members/MemberProfilePage", () => ({ default: () => null }));
vi.mock("@/pages/NotFound", () => ({ default: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import App from "@/App";

describe("F1 App theme (T-F-52)", () => {
  it("does not add .dark on documentElement", async () => {
    document.documentElement.classList.remove("dark");
    render(<App />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
