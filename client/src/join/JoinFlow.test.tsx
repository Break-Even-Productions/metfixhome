/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONBOARDING_ROLES, resolveJoinStepTransition } from "@shared/join";
import { JoinFlow } from "./JoinFlow";
import * as session from "@/lib/session";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockFetch(handlers: Record<string, (init?: RequestInit) => Response | Promise<Response>>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [needle, fn] of Object.entries(handlers)) {
      if (url.includes(needle)) return fn(init);
    }
    return new Response("{}", { status: 404 });
  });
}

describe("P-WJ resolveJoinStepTransition (CQ Trap 3)", () => {
  it("covers signed-in × conditional matrix both directions", () => {
    const cases: Array<{
      signed: boolean;
      roles: ("individual" | "gym_owner" | "clinician")[];
      forward: string[];
      backFromPath: string;
    }> = [
      {
        signed: false,
        roles: ["individual"],
        forward: ["name", "auth", "roles", "path"],
        backFromPath: "roles",
      },
      {
        signed: true,
        roles: ["individual"],
        forward: ["name", "roles", "path"],
        backFromPath: "roles",
      },
      {
        signed: true,
        roles: ["gym_owner"],
        forward: ["name", "roles", "conditional", "path"],
        backFromPath: "conditional",
      },
      {
        signed: false,
        roles: ["clinician"],
        forward: ["name", "auth", "roles", "conditional", "path"],
        backFromPath: "conditional",
      },
    ];
    for (const c of cases) {
      let step = c.forward[0] as "name";
      for (let i = 0; i < c.forward.length - 1; i++) {
        const next = resolveJoinStepTransition(step, 1, {
          isSignedIn: c.signed,
          roles: c.roles,
        });
        expect(next).toBe(c.forward[i + 1]);
        step = next as typeof step;
      }
      expect(
        resolveJoinStepTransition("path", -1, { isSignedIn: c.signed, roles: c.roles }),
      ).toBe(c.backFromPath);
      if (c.signed) {
        expect(
          resolveJoinStepTransition("roles", -1, { isSignedIn: true, roles: c.roles }),
        ).toBe("name");
      }
    }
  });
});

describe("JoinFlow P-WJ-1..8", () => {
  beforeEach(() => {
    vi.spyOn(session, "loadMe").mockResolvedValue({ status: "signed_out" });
    vi.spyOn(session, "refreshMeAfterAuthChange").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
  });

  it("P-WJ-1 NameScreen validates and advances on Enter", async () => {
    const fetchImpl = mockFetch({
      "/api/auth/me": () =>
        Response.json({ signed_in: false }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} />);
    await screen.findByText(/What’s your name/i);
    const first = screen.getByLabelText(/First name/i);
    const last = screen.getByLabelText(/Last name/i);
    fireEvent.change(first, { target: { value: "Pat" } });
    fireEvent.change(last, { target: { value: "Lee" } });
    fireEvent.submit(first.closest("form")!);
    await screen.findByText(/How would you like to continue/i);
  });

  it("P-WJ-2 AuthScreen wires real auth endpoints (no demo account picker)", async () => {
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/auth/login": () => Response.json({ signed_in: true, public_name: "Pat" }),
      "/api/auth/me": () => Response.json({ signed_in: false }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} />);
    await screen.findByText(/What’s your name/i);
    fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: "Pat" } });
    fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: "Lee" } });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Continue with Google/i);
    expect(screen.queryByText(/Jordan Hale/i)).toBeNull();
    expect(screen.queryByText(/mocked Google/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Continue with email/i }));
    const email = await screen.findByLabelText(/^Email$/i);
    fireEvent.change(email, { target: { value: "pat@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    await waitFor(() =>
      expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/api/auth/login"))).toBe(true),
    );
  });

  it("P-WJ-3 RolesScreen shows exact 5 ONBOARDING_ROLES", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/me": () =>
          Response.json({ signed_in: true, public_name: "Pat Lee" }),
      }),
    );
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    for (const role of ONBOARDING_ROLES) {
      expect(screen.getByText(role.title)).toBeTruthy();
      expect(screen.getByText(role.description)).toBeTruthy();
    }
    expect(screen.getByRole("button", { name: /^Continue$/i })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByText("Learning for myself"));
    expect(screen.getByRole("button", { name: /^Continue$/i })).toHaveProperty("disabled", false);
  });

  it("P-WJ-4 Conditional auto-skip when neither gym nor clinician", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/account/onboarding": () => Response.json({ ok: true }),
      "/api/auth/me": () => Response.json({ signed_in: true, public_name: "Pat Lee" }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Learning for myself"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Your recommended path/i);
    expect(screen.queryByText(/physical gym location/i)).toBeNull();
    // exactly one onboarding POST
    await waitFor(() => {
      const posts = fetchImpl.mock.calls.filter((c) =>
        String(c[0]).includes("/api/account/onboarding"),
      );
      expect(posts.length).toBe(1);
    });
  });

  it("P-WJ-5..8 RecommendedPath: pro always, coach 2-path, org $170, no Medical Society tier", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/account/onboarding": () => Response.json({ ok: true }),
      "/api/billing/whop/checkout-session": () =>
        Response.json({ checkout_url: "https://whop.com/c/x" }),
      "/api/auth/me": () => Response.json({ signed_in: true, public_name: "Pat Lee" }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Coach"));
    fireEvent.click(screen.getByText("Gym owner"));
    fireEvent.click(screen.getByText("Clinician"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/physical gym location/i);
    // Yes gym + yes clinic
    const yesButtons = screen.getAllByRole("button", { name: /^Yes$/i });
    fireEvent.click(yesButtons[0]!);
    fireEvent.click(yesButtons[1]!);
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByTestId("pro-plan-card");
    expect(screen.getByTestId("pro-plan-card").textContent).toMatch(/\$30\/month/);
    expect(screen.getByTestId("pro-plan-card").textContent).toMatch(/Cumulative LTV/);
    expect(screen.getByTestId("coach-plan-card").textContent).toMatch(/valid 3 years/i);
    expect(screen.getByTestId("coach-plan-card").textContent).not.toMatch(/one-time credential/i);
    expect(screen.getByTestId("coach-plan-card").textContent).toMatch(/four-figure LTV/i);
    expect(screen.getByTestId("org-plan-card").textContent).toMatch(/\$170\/month/);
    expect(screen.getByTestId("org-plan-card").textContent).toMatch(/\$30\/month/);
    expect(screen.getByTestId("phone-mock")).toBeTruthy();
    // Medical Society informational only — no paid plan/checkout for society
    expect(screen.getByTestId("medical-society-info").textContent).toMatch(
      /not a separate paid subscription/i,
    );
    expect(screen.getByTestId("org-plan-card").textContent).not.toMatch(/166\.60/);

    fireEvent.click(screen.getByRole("button", { name: /Start my free month/i }));
    await waitFor(() => {
      const checkout = fetchImpl.mock.calls.find((c) =>
        String(c[0]).includes("/api/billing/whop/checkout-session"),
      );
      expect(checkout).toBeTruthy();
      expect(JSON.parse(String(checkout?.[1]?.body))).toMatchObject({ plan: "pro" });
    });
  });

  it("WJ4 / WT-J5: zero localStorage/sessionStorage writes during flow", async () => {
    const setItemLocal = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
        "/api/account/onboarding": () => Response.json({ ok: true }),
        "/api/auth/me": () => Response.json({ signed_in: true, public_name: "Pat Lee" }),
      }),
    );
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Learning for myself"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Your recommended path/i);
    const sensitive = setItemLocal.mock.calls.filter((c) => {
      const key = String(c[0]);
      const val = String(c[1] ?? "");
      return (
        /metfix-join-demo|token|password|email|firstName|lastName/i.test(key) ||
        /metfix-join-demo|password|token/i.test(val)
      );
    });
    expect(sensitive).toEqual([]);
  });
});
