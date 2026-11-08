/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import PublicProfilePage from "./PublicProfilePage";

vi.mock("@/hooks/usePageMeta", () => ({
  usePageMeta: () => {},
}));

vi.mock("@/pages/NotFound", () => ({
  default: () => <div>Not Found</div>,
}));

const coach = {
  profile_kind: "metfix",
  member_id: 11,
  display_name: "Avery Coach",
  secondary: "North Loop",
  bio: "Metabolic coaching.",
  location: "Austin, TX",
  website: "https://example.com",
  contact_email: null,
  profile_picture_url: null,
  tags: [],
  socials: [],
  eligibility: ["foundations_coach"],
  profile_url: "/metfix-profile/11",
};

const gym = {
  profile_kind: "affiliate",
  id: 21,
  name: "North Loop",
  slug: "north-loop",
  bio: "A gym affiliate.",
  location: "Austin, TX",
  website: null,
  logo_url: null,
  video_url: null,
  tags: ["Athletes"],
  socials: [],
  is_first_100: false,
  is_international: false,
  team: { owners: [{ member_id: 11, name: "Avery Coach", profile_url: "/metfix-profile/11", profile_picture_url: null }] },
  url: "/affiliates/21/north-loop",
};

const emptyClinic = {
  ...gym,
  profile_kind: "clinic",
  id: 31,
  name: "Front Range Metabolic",
  slug: "front-range",
  bio: null,
  tags: [],
  team: { owners: [] },
  url: "/clinics/31/front-range",
  services: [],
};

const fullClinic = {
  ...emptyClinic,
  id: 32,
  name: "Harbor Clinic",
  slug: "harbor-clinic",
  url: "/clinics/32/harbor-clinic",
  services: [
    {
      id: 1,
      slug: "lab-review",
      name: "Lab review",
      summary: "Review of metabolic labs.",
      note: "Tuesday mornings",
    },
  ],
};

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const ok = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/api/profiles/metfix/11")) return ok(coach);
      if (url.endsWith("/api/profiles/metfix/12")) return ok({ error: "not_found" }, 404);
      if (url.endsWith("/api/profiles/affiliates/21")) return ok(gym);
      if (url.endsWith("/api/profiles/affiliates/31")) return ok({ error: "not_found" }, 404);
      if (url.endsWith("/api/profiles/clinics/31")) return ok(emptyClinic);
      if (url.endsWith("/api/profiles/clinics/32")) return ok(fullClinic);
      if (url.endsWith("/api/profiles/clinics/21")) return ok({ error: "not_found" }, 404);
      return ok({ error: "not_found" }, 404);
    }),
  );
}

function renderAt(path: string) {
  window.history.pushState({}, "", path);
  return render(
    <Router>
      <Route path="/metfix-profile/:memberId" component={PublicProfilePage} />
      <Route path="/affiliates/:id/:slug" component={PublicProfilePage} />
      <Route path="/clinics/:id/:slug" component={PublicProfilePage} />
    </Router>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("public profile skin", () => {
  it("opens a Foundations coach MetFix profile and hides an ordinary member", async () => {
    stubFetch();
    renderAt("/metfix-profile/11");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Avery Coach" })).toBeTruthy());
    expect(screen.getByText("Foundations Coach")).toBeTruthy();
    expect(screen.getByText("MetFix Profile")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Link in bio" }).getAttribute("href")).toBe("/metfix-profile/11/links");
    cleanup();
    stubFetch();
    renderAt("/metfix-profile/12");
    await waitFor(() => expect(screen.getByText("Not Found")).toBeTruthy());
  });

  it("opens the affiliate organization and refuses a clinic-only id", async () => {
    stubFetch();
    renderAt("/affiliates/21/north-loop");
    await waitFor(() => expect(screen.getByRole("heading", { name: "North Loop" })).toBeTruthy());
    expect(screen.getByText("Affiliate")).toBeTruthy();
    expect(screen.getByText("Avery Coach")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Services" })).toBeNull();
    cleanup();
    stubFetch();
    renderAt("/affiliates/31/front-range");
    await waitFor(() => expect(screen.getByText("Not Found")).toBeTruthy());
  });

  it("shows an empty clinic service list and a clinic with services", async () => {
    stubFetch();
    renderAt("/clinics/31/front-range");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Front Range Metabolic" })).toBeTruthy());
    expect(screen.getByText("No services listed yet.")).toBeTruthy();
    cleanup();
    stubFetch();
    renderAt("/clinics/32/harbor-clinic");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Lab review" })).toBeTruthy());
    expect(screen.getByText("Tuesday mornings")).toBeTruthy();
    cleanup();
    stubFetch();
    renderAt("/clinics/21/north-loop");
    await waitFor(() => expect(screen.getByText("Not Found")).toBeTruthy());
  });
});
