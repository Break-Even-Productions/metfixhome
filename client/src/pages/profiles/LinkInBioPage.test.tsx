/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import LinkInBioPage from "./LinkInBioPage";

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
  website: "https://example.com/avery",
  contact_email: "avery@example.com",
  profile_picture_url: null,
  tags: [],
  socials: [{ name: "Instagram", url: "https://instagram.com/avery" }],
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
  website: "https://example.com/north-loop",
  logo_url: null,
  video_url: "https://example.com/watch",
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
  website: null,
  video_url: null,
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
      <Route path="/metfix-profile/:memberId/links" component={LinkInBioPage} />
      <Route path="/affiliates/:id/:slug/links" component={LinkInBioPage} />
      <Route path="/affiliates/:id/links" component={LinkInBioPage} />
      <Route path="/clinics/:id/:slug/links" component={LinkInBioPage} />
      <Route path="/clinics/:id/links" component={LinkInBioPage} />
    </Router>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("link in bio", () => {
  it("opens a coach link page and hides an ordinary member", async () => {
    stubFetch();
    renderAt("/metfix-profile/11/links");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Avery Coach" })).toBeTruthy());
    expect(screen.getByRole("link", { name: "Full profile" }).getAttribute("href")).toBe("/metfix-profile/11");
    expect(screen.getByRole("link", { name: "Website" }).getAttribute("href")).toBe("https://example.com/avery");
    expect(screen.getByRole("link", { name: "Email" }).getAttribute("href")).toBe("mailto:avery@example.com");
    expect(screen.getByRole("link", { name: "Instagram" })).toBeTruthy();
    const mark = screen.getByRole("img", { name: /fork and knife/i });
    expect(mark.querySelectorAll("rect")).toHaveLength(5);
    expect(mark.querySelector(".logo-morph__pill")).toBeTruthy();
    cleanup();
    stubFetch();
    renderAt("/metfix-profile/12/links");
    await waitFor(() => expect(screen.getByText("Not Found")).toBeTruthy());
    expect(screen.queryByRole("img", { name: /fork and knife/i })).toBeNull();
  });

  it("opens the affiliate link page and refuses a clinic-only id", async () => {
    stubFetch();
    renderAt("/affiliates/21/north-loop/links");
    await waitFor(() => expect(screen.getByRole("heading", { name: "North Loop" })).toBeTruthy());
    expect(screen.getByText("Affiliate")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Watch" }).getAttribute("href")).toBe("https://example.com/watch");
    expect(screen.getByRole("link", { name: "Avery Coach" }).getAttribute("href")).toBe("/metfix-profile/11");
    expect(screen.queryByText("Lab review")).toBeNull();
    cleanup();
    stubFetch();
    renderAt("/affiliates/31/front-range/links");
    await waitFor(() => expect(screen.getByText("Not Found")).toBeTruthy());
  });

  it("lists clinic services when present and stays empty without them", async () => {
    stubFetch();
    renderAt("/clinics/31/front-range/links");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Front Range Metabolic" })).toBeTruthy());
    expect(screen.queryByText("No services listed yet.")).toBeNull();
    expect(screen.queryByText("Lab review")).toBeNull();
    cleanup();
    stubFetch();
    renderAt("/clinics/32/harbor-clinic/links");
    await waitFor(() => expect(screen.getByText("Lab review")).toBeTruthy());
    expect(screen.getByText("Tuesday mornings")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Full profile" }).getAttribute("href")).toBe("/clinics/32/harbor-clinic");
    cleanup();
    stubFetch();
    renderAt("/clinics/21/north-loop/links");
    await waitFor(() => expect(screen.getByText("Not Found")).toBeTruthy());
  });
});
