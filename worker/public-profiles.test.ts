import { describe, expect, it, vi } from "vitest";
import { handlePublicProfileRoutes, shapePublicProfile } from "./public-profiles";
import type { Env } from "./upstream";

function env(): Env {
  return {} as Env;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("shapePublicProfile", () => {
  it("requires eligibility and drops HTML badge markup", () => {
    expect(
      shapePublicProfile("metfix", {
        profile_kind: "metfix",
        member_id: 4,
        display_name: "Pat",
        eligibility: [],
        role_badges_html: "<script>alert(1)</script>",
      }),
    ).toBeNull();
    const shaped = shapePublicProfile("metfix", {
      profile_kind: "metfix",
      member_id: 4,
      display_name: "Pat",
      eligibility: ["metfix_pro", "nope"],
      role_badges_html: "<b>Coach</b>",
      bio: "Hi",
    });
    expect(shaped).toMatchObject({ eligibility: ["metfix_pro"], bio: "Hi" });
    expect(JSON.stringify(shaped)).not.toContain("script");
    expect(JSON.stringify(shaped)).not.toContain("<b>");
  });

  it("keeps an empty clinic service list and rejects a gym payload on the clinic route", () => {
    expect(
      shapePublicProfile("clinic", {
        profile_kind: "clinic",
        id: 3,
        name: "Front Range",
        slug: "front-range",
        services: [],
        team: { owners: [] },
      }),
    ).toMatchObject({ services: [] });
    expect(
      shapePublicProfile("clinic", {
        profile_kind: "affiliate",
        id: 3,
        name: "Gym",
        slug: "gym",
        services: [],
      }),
    ).toBeNull();
  });
});

describe("handlePublicProfileRoutes", () => {
  it("proxies eligible profiles and passes through 404s without an API key", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      const headers = new Headers(init?.headers);
      expect(headers.get("X-API-Key")).toBeNull();
      expect(headers.get("Authorization")).toBeNull();
      if (url.endsWith("/profiles/public/metfix/11")) {
        return jsonResponse({
          profile_kind: "metfix",
          member_id: 11,
          display_name: "Avery Coach",
          eligibility: ["foundations_coach"],
          role_badges_html: "<img src=x onerror=alert(1)>",
        });
      }
      if (url.endsWith("/profiles/public/metfix/12")) return jsonResponse({ code: "profile_not_found" }, 404);
      if (url.endsWith("/profiles/public/clinics/31")) {
        return jsonResponse({
          profile_kind: "clinic",
          id: 31,
          name: "Front Range",
          slug: "front-range",
          services: [],
          team: { owners: [] },
        });
      }
      return jsonResponse({}, 500);
    });

    const coach = await handlePublicProfileRoutes(
      new Request("https://metfix.org/api/profiles/metfix/11"),
      env(),
      { fetchImpl, bsiBaseUrl: "https://api.brokenscience.org" },
    );
    expect(coach?.status).toBe(200);
    const coachBody = await coach?.json();
    expect(coachBody.eligibility).toEqual(["foundations_coach"]);
    expect(JSON.stringify(coachBody)).not.toContain("onerror");

    const hidden = await handlePublicProfileRoutes(
      new Request("https://metfix.org/api/profiles/metfix/12"),
      env(),
      { fetchImpl, bsiBaseUrl: "https://api.brokenscience.org" },
    );
    expect(hidden?.status).toBe(404);

    const clinic = await handlePublicProfileRoutes(
      new Request("https://metfix.org/api/profiles/clinics/31"),
      env(),
      { fetchImpl, bsiBaseUrl: "https://api.brokenscience.org" },
    );
    expect(clinic?.status).toBe(200);
    expect((await clinic?.json()).services).toEqual([]);
    expect(urls.every((url) => url.startsWith("https://api.brokenscience.org/wp-json/bsi/v1/profiles/public/"))).toBe(
      true,
    );
  });

  it("rejects non-numeric ids before calling BSI", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const res = await handlePublicProfileRoutes(
      new Request("https://metfix.org/api/profiles/metfix/abc"),
      env(),
      { fetchImpl },
    );
    expect(res?.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
