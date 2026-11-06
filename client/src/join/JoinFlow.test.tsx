/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_BODY_KEYS,
  ONBOARDING_ROLES,
  PRO_CARD_HEADER,
  SIGNUP_BODY_KEYS,
  clampJoinDeepLink,
  facilityFlagsForRoles,
  resolveJoinStepTransition,
  showOrganizationOwnerCard,
} from "@shared/join";
import { JoinFlow } from "./JoinFlow";
import { JoinFlowProvider, useJoinFlow } from "@/contexts/JoinFlowContext";
import { clearAccountCache } from "@/lib/account";
import * as session from "@/lib/session";

const APP_TSX = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf8");

afterEach(async () => {
  cleanup();
  clearAccountCache();
  window.history.pushState({}, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (window as unknown as { grecaptcha?: unknown }).grecaptcha;
  delete (window as unknown as { __MFX_RECAPTCHA_SITE_KEY__?: unknown })
    .__MFX_RECAPTCHA_SITE_KEY__;
  const { clearCsrfCache } = await import("@/lib/authRequest");
  clearCsrfCache();
});

function stubRecaptcha(token = "recaptcha-ok") {
  (
    window as unknown as { __MFX_RECAPTCHA_SITE_KEY__: string }
  ).__MFX_RECAPTCHA_SITE_KEY__ = "test-site-key";
  (
    window as unknown as {
      grecaptcha: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, opts: { action: string }) => Promise<string>;
      };
    }
  ).grecaptcha = {
    ready: (cb) => cb(),
    execute: async () => token,
  };
}

function mockFetch(
  handlers: Record<
    string,
    (init?: RequestInit) => Response | Promise<Response>
  >,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const [needle, fn] of Object.entries(handlers)) {
      if (url.includes(needle)) return fn(init);
    }
    return new Response("{}", { status: 404 });
  });
}

describe("P-WJ resolveJoinStepTransition (CQ Trap 3)", () => {
  it("keeps name, roles, and plan behind sign-in", () => {
    expect(
      resolveJoinStepTransition("auth", 1, { isSignedIn: false, roles: [] }),
    ).toBeNull();
    expect(
      resolveJoinStepTransition("name", 1, {
        isSignedIn: false,
        roles: ["individual"],
      }),
    ).toBe("auth");
    expect(
      resolveJoinStepTransition("roles", 1, {
        isSignedIn: false,
        roles: ["clinician"],
      }),
    ).toBe("auth");

    const cases: Array<{
      roles: ("individual" | "gym_owner")[];
      forward: string[];
      backFromPath: string;
    }> = [
      {
        roles: ["individual"],
        forward: ["name", "roles", "path"],
        backFromPath: "roles",
      },
      {
        roles: ["gym_owner"],
        forward: ["name", "roles", "conditional", "path"],
        backFromPath: "conditional",
      },
    ];
    for (const c of cases) {
      let step = c.forward[0] as "name";
      for (let i = 0; i < c.forward.length - 1; i++) {
        const next = resolveJoinStepTransition(step, 1, {
          isSignedIn: true,
          roles: c.roles,
        });
        expect(next).toBe(c.forward[i + 1]);
        step = next as typeof step;
      }
      expect(
        resolveJoinStepTransition("path", -1, {
          isSignedIn: true,
          roles: c.roles,
        }),
      ).toBe(c.backFromPath);
      expect(
        resolveJoinStepTransition("roles", -1, {
          isSignedIn: true,
          roles: c.roles,
        }),
      ).toBe("name");
    }
  });
});

describe("JoinFlow P-WJ-1..8", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/join");
    vi.spyOn(session, "loadMe").mockResolvedValue({ status: "signed_out" });
    vi.spyOn(session, "refreshMeAfterAuthChange").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
  });

  it("P-WJ-1 NameScreen validates and advances on Enter", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "",
      moderator: false,
    });
    const fetchImpl = mockFetch({
      "/api/auth/me": () => Response.json({ signed_in: true, public_name: "" }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} />);
    const first = await screen.findByLabelText(/First name/i);
    const last = screen.getByLabelText(/Last name/i);
    fireEvent.change(first, { target: { value: "Pat" } });
    fireEvent.change(last, { target: { value: "Lee" } });
    fireEvent.submit(first.closest("form")!);
    await screen.findByText(/Which of these best describes you/i);
    expect(screen.queryByText(/Create an account or sign in/i)).toBeNull();
  });

  it("starts on signup/sign-in and hides name, roles, and plan until authenticated", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/me": () => Response.json({ signed_in: false }),
      }),
    );
    const { unmount } = render(<JoinFlow open onClose={() => {}} />);
    await screen.findByText(/Create an account or sign in/i);
    expect(
      screen.getByRole("button", { name: /Sign up with email/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Continue with Google/i }),
    ).toBeTruthy();
    expect(screen.queryByText(/What’s your name/i)).toBeNull();
    expect(screen.queryByText(/Which of these best describes you/i)).toBeNull();
    expect(screen.queryByText(/Your recommended path/i)).toBeNull();
    expect(
      screen.queryByText(/Explore MetFix free for your first month/i),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    await screen.findByLabelText(/^Email$/i);
    expect(screen.getByLabelText(/^Password$/i)).toBeTruthy();
    expect(screen.getByText(/Need an account\?/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Sign up$/i })).toBeTruthy();
    unmount();

    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    render(<JoinFlow open onClose={() => {}} initialStep="affiliate" />);
    expect(await screen.findByTestId("affiliate-fillout-embed")).toBeTruthy();
    expect(
      screen
        .getByTestId("affiliate-fillout-embed")
        .getAttribute("data-fillout-id"),
    ).toBe("xxsjDS5H96us");
    expect(screen.queryByText(/Create an account or sign in/i)).toBeNull();
  });

  it("WJ1: empty / >80 name shows error+aria-describedby; Enter submits; /me prefills", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Alex Rivera",
      moderator: false,
    });
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/me": () =>
          Response.json({ signed_in: true, public_name: "Alex Rivera" }),
        "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
        "/api/account/onboarding": () => Response.json({ ok: true }),
      }),
    );

    const { unmount } = render(<JoinFlow open onClose={() => {}} />);
    await screen.findByDisplayValue("Alex");
    expect(screen.getByDisplayValue("Rivera")).toBeTruthy();
    unmount();

    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "",
      moderator: false,
    });
    render(<JoinFlow open onClose={() => {}} />);
    const first = await screen.findByLabelText(/First name/i);
    fireEvent.submit(first.closest("form")!);
    await waitFor(() => {
      expect(screen.getAllByText(/^Required$/i).length).toBeGreaterThanOrEqual(
        1,
      );
    });
    expect(first.getAttribute("aria-describedby")).toBe("join-first-name-err");
    expect(document.getElementById("join-first-name-err")?.textContent).toMatch(
      /Required/i,
    );

    fireEvent.change(first, { target: { value: "x".repeat(81) } });
    fireEvent.change(screen.getByLabelText(/Last name/i), {
      target: { value: "Lee" },
    });
    expect(screen.getByText(/80 characters or fewer/i)).toBeTruthy();
    expect(first.getAttribute("aria-describedby")).toBe("join-first-name-err");

    fireEvent.change(first, { target: { value: "Pat" } });
    fireEvent.submit(first.closest("form")!);
    await screen.findByText(/Which of these best describes you/i);
  });

  it("WJ11: exact PRO header, busy/disabled, double-click → 1 checkout; affiliate includes Pro", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    let checkoutN = 0;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf"))
          return Response.json({ csrf: "tok" });
        if (url.includes("/api/account/onboarding"))
          return Response.json({ ok: true });
        if (url.includes("/api/billing/whop/checkout-session")) {
          checkoutN += 1;
          await new Promise((r) => setTimeout(r, 40));
          return Response.json({ checkout_url: "https://whop.com/c/x" });
        }
        if (url.includes("/api/auth/me")) {
          return Response.json({ signed_in: true, public_name: "Pat Lee" });
        }
        return new Response("{}", { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchImpl);

    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Gym owner"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/physical gym location/i);
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByTestId("pro-plan-card");

    expect(screen.getByTestId("pro-plan-card").textContent).toContain(
      PRO_CARD_HEADER.replace(/ · /g, "\n").split("\n")[0]!,
    );
    expect(screen.getByTestId("pro-plan-card").textContent).toMatch(
      /First month free/,
    );
    expect(screen.getByTestId("pro-plan-card").textContent).toMatch(
      /\$30\/month/,
    );
    expect(screen.getByTestId("org-plan-card").textContent).toMatch(
      /\$30\/month MetFix Pro is included/,
    );

    const cta = screen.getByRole("button", { name: /Start my free month/i });
    fireEvent.click(cta);
    fireEvent.click(cta);
    await waitFor(() => expect(cta).toHaveProperty("disabled", true));
    await waitFor(() => expect(checkoutN).toBe(1));
  });

  it("Google start uses return= (handler param) round-trip", async () => {
    const fetchImpl = mockFetch({
      "/api/auth/me": () => Response.json({ signed_in: false }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    const assign = vi.fn();
    const loc = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...loc,
        assign,
        href: "https://metfix.org/join",
        origin: "https://metfix.org",
      },
    });
    try {
      render(<JoinFlow open onClose={() => {}} />);
      await screen.findByText(/Create an account or sign in/i);
      fireEvent.click(
        screen.getByRole("button", { name: /Continue with Google/i }),
      );
      expect(assign).toHaveBeenCalled();
      const url = String(
        assign.mock.calls.find((c) =>
          String(c[0]).includes("google/start"),
        )?.[0] ?? "",
      );
      expect(url).toMatch(/\/api\/auth\/google\/start\?return=/);
      expect(url).not.toMatch(/return_to=/);
      const ret = new URL(url, "https://metfix.org").searchParams.get("return");
      expect(ret).toBe("/join?step=name");
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: loc,
      });
    }
  });

  it("P-WJ-2 AuthScreen wires real auth endpoints (no demo account picker)", async () => {
    stubRecaptcha();
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/auth/login": () =>
        Response.json({ signed_in: true, public_name: "Pat" }),
      "/api/auth/me": () => Response.json({ signed_in: false }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} />);
    await screen.findByText(/Create an account or sign in/i);
    expect(screen.queryByText(/What’s your name/i)).toBeNull();
    expect(screen.queryByText(/Jordan Hale/i)).toBeNull();
    expect(screen.queryByText(/mocked Google/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    const email = await screen.findByLabelText(/^Email$/i);
    fireEvent.change(email, { target: { value: "pat@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    await waitFor(() =>
      expect(
        fetchImpl.mock.calls.some((c) =>
          String(c[0]).includes("/api/auth/login"),
        ),
      ).toBe(true),
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
    expect(screen.getByRole("button", { name: /^Continue$/i })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(screen.getByText("Learning for myself"));
    expect(screen.getByRole("button", { name: /^Continue$/i })).toHaveProperty(
      "disabled",
      false,
    );
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
      "/api/auth/me": () =>
        Response.json({ signed_in: true, public_name: "Pat Lee" }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Learning for myself"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Recommended for you/i);
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
      "/api/auth/me": () =>
        Response.json({ signed_in: true, public_name: "Pat Lee" }),
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
    expect(screen.getByTestId("pro-plan-card").textContent).toMatch(
      /\$30\/month/,
    );
    expect(screen.getByTestId("pro-plan-card").textContent).toMatch(
      /1 Free Online Course per month/,
    );
    expect(screen.getByTestId("pro-plan-card").textContent).toMatch(
      /Exclusive resources/,
    );
    expect(screen.getByTestId("pro-plan-card").textContent).toMatch(/AI Tools/);
    expect(screen.getByTestId("pro-plan-card").textContent).not.toMatch(
      /Cumulative LTV|Full access to online courses/i,
    );
    expect(screen.getByTestId("coach-plan-card").textContent).toMatch(
      /valid 3 years/i,
    );
    expect(screen.getByTestId("coach-plan-card").textContent).not.toMatch(
      /one-time credential|four-figure LTV|Cumulative LTV/i,
    );
    expect(screen.getByTestId("org-plan-card").textContent).toMatch(
      /\$170\/month/,
    );
    expect(screen.getByTestId("org-plan-card").textContent).not.toMatch(
      /First month free/i,
    );
    expect(screen.getByTestId("org-plan-card").textContent).toMatch(
      /\$30\/month/,
    );
    expect(screen.getByTestId("org-plan-card").textContent).toMatch(
      /Exclusive resources/,
    );
    expect(screen.getByTestId("org-plan-card").textContent).toMatch(/AI Tools/);
    expect(screen.queryByTestId("seminars-cta-card")).toBeNull();
    expect(screen.queryByText(/In-person seminars/i)).toBeNull();
    expect(screen.queryByTestId("phone-mock")).toBeNull();
    expect(screen.queryByText(/Take MetFix with you/i)).toBeNull();
    expect(
      screen.queryByText(/Your first month stays free/i),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /Go to Dashboard/i })).toBeNull();
    expect(screen.getByTestId("recommended-courses")).toBeTruthy();
    const whatIs = screen.getByRole("link", { name: /What Is MetFix\?/i });
    expect(whatIs.getAttribute("href")).toBe("https://whatis.metfix.org/");
    expect(whatIs.getAttribute("target")).toBe("_blank");
    const essentials = screen.getByRole("link", { name: /MetFix Essentials Advanced/i });
    expect(essentials.getAttribute("href")).toBe(
      "https://brokenscience.org/courses/metfix-foundation-seminar-course/",
    );
    expect(
      screen.getByRole("link", { name: /MetFix Medical Nutrition/i }).getAttribute("href"),
    ).toBe("http://medicalmetfix.com/");
    expect(screen.queryByText(/Metabolic Health Foundations/i)).toBeNull();
    expect(screen.queryByText(/Start course/i)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /explore=medical-society/i }),
    ).toBeNull();
    // Medical Society informational only — no paid plan/checkout for society
    expect(screen.getByTestId("medical-society-info").textContent).toMatch(
      /not a separate paid subscription/i,
    );
    expect(screen.getByTestId("org-plan-card").textContent).not.toMatch(
      /166\.60/,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Start my free month/i }),
    );
    await waitFor(() => {
      const checkout = fetchImpl.mock.calls.find((c) =>
        String(c[0]).includes("/api/billing/whop/checkout-session"),
      );
      expect(checkout).toBeTruthy();
      expect(JSON.parse(String(checkout?.[1]?.body))).toMatchObject({
        plan: "pro",
        return_path: "/join?purchased=1",
      });
    });
  });

  it("affiliate CTA opens the application and does not start org checkout", async () => {
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
      "/api/auth/me": () =>
        Response.json({ signed_in: true, public_name: "Pat Lee" }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Gym owner"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/physical gym location/i);
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByTestId("org-plan-card");
    fireEvent.click(
      screen.getByRole("button", { name: /Start my Affiliate membership/i }),
    );
    expect(await screen.findByTestId("affiliate-fillout-embed")).toBeTruthy();
    expect(
      fetchImpl.mock.calls.some((c) =>
        String(c[0]).includes("/api/billing/whop/checkout-session"),
      ),
    ).toBe(false);
  });

  it("shows the recommended path after a successful membership purchase", async () => {
    window.history.pushState({}, "", "/join?purchased=1");
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
    render(<JoinFlow open onClose={() => {}} />);
    await screen.findByText(/Your recommended path/i);
    const dashboard = screen.getByRole("link", { name: /Go to Dashboard/i });
    const courses = screen.getByRole("link", { name: /Course list/i });
    const resources = screen.getByRole("link", { name: /^Resources/i });
    expect(dashboard.getAttribute("href")).toBe("/account");
    expect(courses.getAttribute("href")).toBe("/courses");
    expect(resources.getAttribute("href")).toBe("/library");
    expect(dashboard.className).toMatch(/join-next-step--primary/);
    expect(courses.className).toMatch(/join-next-step/);
    expect(screen.queryByTestId("pro-plan-card")).toBeNull();
    expect(screen.queryByTestId("phone-mock")).toBeNull();
    expect(screen.queryByText(/Take MetFix with you/i)).toBeNull();
  });

  it("does not recommend MetFix Pro to an active affiliate on the free tier", async () => {
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
        "/api/account/subscriptions": () =>
          Response.json({
            canonical_tier: "free",
            items: [
              {
                sub_ref: "aff",
                provider: "stripe",
                tier: "organization_owner",
                legacy_source: "affiliate_stripe",
                status: "active",
                current_period_end: null,
                paid_through: null,
                cancel_at_period_end: false,
                card: null,
              },
            ],
          }),
        "/api/account/overview": () =>
          Response.json({
            canonical_tier: "free",
            badges: { medical: false, affiliate: true, subscription: false, foundations_coach: false },
            display_name: "Pat Lee",
            foundations_coach: {
              active: false,
              granted_at: null,
              expires_at: null,
              seminar_checked_in: false,
              metfix_essentials_completed: false,
              metfix_essentials_certificate_claimed: false,
              paths: [],
            },
          }),
        "/api/auth/me": () =>
          Response.json({ signed_in: true, public_name: "Pat Lee" }),
      }),
    );
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Learning for myself"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Your recommended path/i);
    expect(screen.queryByTestId("pro-plan-card")).toBeNull();
  });

  it("shows the recommended path when the account already has a membership", async () => {
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
        "/api/account/subscriptions": () =>
          Response.json({ canonical_tier: "metfix_pro", items: [] }),
        "/api/auth/me": () =>
          Response.json({ signed_in: true, public_name: "Pat Lee" }),
      }),
    );
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Learning for myself"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Your recommended path/i);
    expect(screen.getByRole("link", { name: /Go to Dashboard/i })).toBeTruthy();
    expect(screen.queryByTestId("pro-plan-card")).toBeNull();
  });

  it("WJ4 / WT-J5: zero localStorage/sessionStorage writes during flow", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
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
        "/api/auth/me": () =>
          Response.json({ signed_in: true, public_name: "Pat Lee" }),
      }),
    );
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Learning for myself"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Recommended for you/i);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("WJ4 OAuth resume: signed-in ?step=roles lands on roles (not auth)", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    window.history.pushState({}, "", "/join?step=roles");
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/me": () =>
          Response.json({ signed_in: true, public_name: "Pat Lee" }),
      }),
    );
    render(<JoinFlow open onClose={() => {}} />);
    await screen.findByText(/Which of these best describes you/i);
    expect(screen.queryByText(/Continue with Google/i)).toBeNull();
  });

  it("B1: login body uses exact `recaptcha` key (shared LoginBody)", async () => {
    stubRecaptcha("recaptcha-login");
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/auth/login": () =>
        Response.json({ signed_in: true, public_name: "Pat" }),
      "/api/auth/me": () => Response.json({ signed_in: false }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} />);
    await screen.findByText(/Create an account or sign in/i);
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    fireEvent.change(await screen.findByLabelText(/^Email$/i), {
      target: { value: "pat@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    await waitFor(() => {
      const loginCall = fetchImpl.mock.calls.find((c) =>
        String(c[0]).includes("/api/auth/login"),
      );
      expect(loginCall).toBeTruthy();
      const body = JSON.parse(String(loginCall?.[1]?.body));
      expect(Object.keys(body).sort()).toEqual([...LOGIN_BODY_KEYS].sort());
      expect(body).toHaveProperty("recaptcha");
      expect(body).not.toHaveProperty("recaptcha_token");
    });
  });

  it("B1: signup body uses username+email+recaptcha (no password)", async () => {
    stubRecaptcha("recaptcha-signup");
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/auth/signup": () =>
        Response.json({ status: "check_email" }, { status: 202 }),
      "/api/auth/me": () => Response.json({ signed_in: false }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} initialStep="auth" />);
    await screen.findByText(/Create an account or sign in/i);
    fireEvent.click(
      screen.getByRole("button", { name: /Sign up with email/i }),
    );
    await screen.findByLabelText(/^Username$/i);
    fireEvent.change(await screen.findByLabelText(/^Username$/i), {
      target: { value: "patlee" },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: "pat@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));
    await waitFor(() => {
      const signupCall = fetchImpl.mock.calls.find((c) =>
        String(c[0]).includes("/api/auth/signup"),
      );
      expect(signupCall).toBeTruthy();
      const body = JSON.parse(String(signupCall?.[1]?.body));
      expect(Object.keys(body).sort()).toEqual([...SIGNUP_BODY_KEYS].sort());
      expect(body).not.toHaveProperty("password");
      expect(body).not.toHaveProperty("recaptcha_token");
    });
  });

  it("B2: double-click Continue while saving → 1 POST; failed save stays off path", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    let resolveOnboarding!: (v: Response) => void;
    const deferred = new Promise<Response>((r) => {
      resolveOnboarding = r;
    });
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/account/onboarding": () => deferred,
      "/api/auth/me": () =>
        Response.json({ signed_in: true, public_name: "Pat Lee" }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Learning for myself"));
    const cont = screen.getByRole("button", { name: /^Continue$/i });
    fireEvent.click(cont);
    fireEvent.click(cont);
    fireEvent.click(cont);
    await waitFor(() => {
      expect(
        fetchImpl.mock.calls.filter((c) =>
          String(c[0]).includes("/api/account/onboarding"),
        ).length,
      ).toBe(1);
    });
    expect(screen.queryByText(/Your recommended path/i)).toBeNull();
    resolveOnboarding(Response.json({ error: "nope" }, { status: 500 }));
    await screen.findByRole("alert");
    expect(screen.queryByText(/Your recommended path/i)).toBeNull();
  });

  it("B3: deselect gym_owner clears org card and sends has_physical_gym null", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/account/onboarding": () => Response.json({ ok: true }),
      "/api/auth/me": () =>
        Response.json({ signed_in: true, public_name: "Pat Lee" }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} initialStep="roles" />);
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Gym owner"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/physical gym location/i);
    fireEvent.click(screen.getByRole("button", { name: /^Yes$/i }));
    fireEvent.click(screen.getByLabelText(/Back/i));
    await screen.findByText(/Which of these best describes you/i);
    fireEvent.click(screen.getByText("Gym owner")); // deselect
    fireEvent.click(screen.getByText("Learning for myself"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Recommended for you/i);
    expect(screen.queryByTestId("org-plan-card")).toBeNull();
    await waitFor(() => {
      const post = fetchImpl.mock.calls.find((c) =>
        String(c[0]).includes("/api/account/onboarding"),
      );
      expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
        has_physical_gym: null,
        has_physical_clinic: null,
      });
    });
  });

  it("B4: signed-in ?step=auth clamps to name; signed-out ?step=path stays on auth", async () => {
    expect(clampJoinDeepLink("auth", { isSignedIn: true, roles: [] })).toBe(
      "name",
    );
    expect(clampJoinDeepLink("path", { isSignedIn: true, roles: [] })).toBe(
      "roles",
    );
    expect(clampJoinDeepLink("path", { isSignedIn: false, roles: [] })).toBe(
      "auth",
    );

    vi.spyOn(session, "loadMe").mockResolvedValue({
      status: "signed_in",
      public_name: "Pat Lee",
      moderator: false,
    });
    window.history.pushState({}, "", "/join?step=auth");
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/me": () =>
          Response.json({ signed_in: true, public_name: "Pat Lee" }),
      }),
    );
    render(<JoinFlow open onClose={() => {}} initialStep="auth" />);
    await screen.findByText(/What’s your name/i);
    expect(screen.queryByText(/Continue with Google/i)).toBeNull();
    expect(screen.queryByText(/Your recommended path/i)).toBeNull();
  });
});

describe("facilityFlagsForRoles / showOrganizationOwnerCard (B3)", () => {
  it("never keeps true when role deselected", () => {
    expect(facilityFlagsForRoles(["individual"], true, true)).toEqual({
      has_physical_gym: null,
      has_physical_clinic: null,
    });
    expect(showOrganizationOwnerCard(["individual"], true, true)).toBe(false);
    expect(showOrganizationOwnerCard(["gym_owner"], true, null)).toBe(true);
  });
});

describe("WJ15 /join + useJoinFlow modal Esc focus", () => {
  it("useJoinFlow opens modal; Esc closes and restores focus to the trigger itself", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({ status: "signed_out" });
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/me": () => Response.json({ signed_in: false }),
      }),
    );
    function Trigger() {
      const { openJoinFlow } = useJoinFlow();
      return (
        <button type="button" onClick={() => openJoinFlow()}>
          Open join
        </button>
      );
    }
    render(
      <JoinFlowProvider>
        <Trigger />
      </JoinFlowProvider>,
    );
    const trigger = screen.getByRole("button", { name: /Open join/i });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: /Join MetFix/i });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Join MetFix/i })).toBeNull();
    });
    await waitFor(
      () => {
        expect(document.activeElement).toBe(trigger);
      },
      { timeout: 2000 },
    );
  });

  it("/join route renders JoinFlow standalone", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({ status: "signed_out" });
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/me": () => Response.json({ signed_in: false }),
      }),
    );
    window.history.pushState({}, "", "/join");
    const { default: JoinPage } = await import("@/pages/join/JoinPage");
    render(<JoinPage />);
    expect(
      await screen.findByRole("dialog", { name: /Join MetFix/i }),
    ).toBeTruthy();
    expect(
      await screen.findByText(/Create an account or sign in/i),
    ).toBeTruthy();
    expect(screen.queryByText(/What’s your name/i)).toBeNull();
  });

  it("/join?x=1 still routes to JoinPage (wouter pathname; no dead /join? startsWith)", async () => {
    vi.spyOn(session, "loadMe").mockResolvedValue({ status: "signed_out" });
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/auth/me": () => Response.json({ signed_in: false }),
      }),
    );
    window.history.pushState({}, "", "/join?x=1");
    expect(APP_TSX).not.toMatch(/startsWith\("\/join\?"\)/);
    // Pathname-only hideGlobalNav covers `/join?x=1` without a dead startsWith.
    expect(APP_TSX).toMatch(/pathOnly === "\/join"/);
    const { default: JoinPage } = await import("@/pages/join/JoinPage");
    render(<JoinPage />);
    expect(
      await screen.findByRole("dialog", { name: /Join MetFix/i }),
    ).toBeTruthy();
  });
});

describe("NB2 CSRF session-tied + email→onboarding→checkout", () => {
  it("403 login retries once with fresh CSRF then onboarding+checkout use postJsonWithCsrf", async () => {
    stubRecaptcha("recaptcha-ok");
    let csrfN = 0;
    let loginN = 0;
    const tokens: string[] = [];
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("/api/auth/csrf")) {
          csrfN += 1;
          return Response.json({ csrf: `csrf-${csrfN}` });
        }
        if (url.includes("/api/auth/login")) {
          loginN += 1;
          const hdrs = new Headers(init?.headers);
          tokens.push(hdrs.get("X-CSRF-Token") ?? "");
          if (loginN === 1)
            return Response.json({ error: "csrf" }, { status: 403 });
          return Response.json({ signed_in: true, public_name: "Pat Lee" });
        }
        if (url.includes("/api/account/onboarding")) {
          const hdrs = new Headers(init?.headers);
          tokens.push(hdrs.get("X-CSRF-Token") ?? "");
          return Response.json({ ok: true });
        }
        if (url.includes("/api/billing/whop/checkout-session")) {
          const hdrs = new Headers(init?.headers);
          tokens.push(hdrs.get("X-CSRF-Token") ?? "");
          return Response.json({ checkout_url: "https://whop.com/c/x" });
        }
        if (url.includes("/api/auth/me")) {
          return Response.json({
            signed_in: loginN >= 2,
            public_name: "Pat Lee",
          });
        }
        return new Response("{}", { status: 404 });
      },
    );
    vi.stubGlobal("fetch", fetchImpl);
    vi.spyOn(session, "loadMe").mockResolvedValue({ status: "signed_out" });
    vi.spyOn(session, "refreshMeAfterAuthChange").mockImplementation(
      async () => {
        // Simulate sid change clearing CSRF (session.ts)
        const { clearCsrfCache } = await import("@/lib/authRequest");
        clearCsrfCache();
        return {
          status: "signed_in",
          public_name: "Pat Lee",
          moderator: false,
        };
      },
    );

    render(<JoinFlow open onClose={() => {}} />);
    await screen.findByText(/Create an account or sign in/i);
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    fireEvent.change(await screen.findByLabelText(/^Email$/i), {
      target: { value: "pat@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));

    fireEvent.change(await screen.findByLabelText(/First name/i), {
      target: { value: "Pat" },
    });
    fireEvent.change(screen.getByLabelText(/Last name/i), {
      target: { value: "Lee" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Which of these best describes you/i);
    expect(loginN).toBe(2);
    expect(tokens[0]).toBe("csrf-1");
    expect(tokens[1]).toBe("csrf-2");

    fireEvent.click(screen.getByText("Learning for myself"));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    await screen.findByText(/Recommended for you/i);
    fireEvent.click(
      screen.getByRole("button", { name: /Start my free month/i }),
    );
    await waitFor(() => {
      expect(
        fetchImpl.mock.calls.some((c) =>
          String(c[0]).includes("/api/billing/whop/checkout-session"),
        ),
      ).toBe(true);
    });
    // Onboarding + checkout each carried a CSRF header (fresh after sign-in clear).
    expect(tokens.length).toBeGreaterThanOrEqual(4);
    expect(tokens.slice(2).every((t) => t.startsWith("csrf-"))).toBe(true);
  });

  it("R2-N2: missing grecaptcha shows load-fail message (no silent empty token)", async () => {
    // no stubRecaptcha
    const fetchImpl = mockFetch({
      "/api/auth/csrf": () => Response.json({ csrf: "tok" }),
      "/api/auth/me": () => Response.json({ signed_in: false }),
    });
    vi.stubGlobal("fetch", fetchImpl);
    render(<JoinFlow open onClose={() => {}} initialStep="auth" />);
    await screen.findByText(/Create an account or sign in/i);
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    fireEvent.change(await screen.findByLabelText(/^Email$/i), {
      target: { value: "pat@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/^Password$/i), {
      target: { value: "password1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Could not load the security check/i);
    expect(
      fetchImpl.mock.calls.some((c) =>
        String(c[0]).includes("/api/auth/login"),
      ),
    ).toBe(false);
  });
});
