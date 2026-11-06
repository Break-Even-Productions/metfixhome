import { describe, expect, it, vi } from "vitest";
import type { ActingContext } from "./auth/acting";
import { handleDirectoryRoutes } from "./directory";
import { handleRequest, type Env } from "./index";

const GYM_SECRET = "gym-map-secret";
const COACH_SECRET = "coach-map-secret";

function env(partial: Partial<Env> = {}): Env {
  return partial as Env;
}

function acting(): ActingContext {
  const now = Date.now();
  return {
    sid: "sid",
    hex: "ab",
    access: "access-token",
    record: {
      bsi_access: "access-token",
      bsi_refresh: "refresh",
      access_exp: now + 60_000,
      user_public_name: "Member",
      bsi_user_id: "1",
      can_moderate: false,
      created: now,
      last_seen: now,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("directory routes", () => {
  it("gyms proxy the affiliate map and never return the secret", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("page=2")) {
        return jsonResponse({ affiliates: [], has_more: false });
      }
      return jsonResponse({
        affiliates: [
          {
            affiliate_id: 7,
            affiliate_name: "North Loop",
            lat: 30.27,
            lng: -97.74,
            city: "Austin",
            state_abbr: "TX",
            communities_served: [{ label: "Athletes", value: 1 }],
          },
        ],
        has_more: true,
      });
    });
    const res = await handleDirectoryRoutes(
      new Request("https://metfix.org/api/directory/gyms"),
      env({ BSI_AFFILIATES_MAP_SECRET: GYM_SECRET }),
      undefined,
      { fetchImpl },
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain(GYM_SECRET);
    expect(urls[0]).toContain(`secret=${GYM_SECRET}`);
    expect(urls.some((url) => url.includes("/wp-json/bsi/v1/affiliates"))).toBe(true);
    expect(JSON.parse(body).listings[0]).toMatchObject({ id: "gym:7", name: "North Loop" });
  });

  it("returns 503 for gyms when the map secret is missing and does not call BSI", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const res = await handleDirectoryRoutes(
      new Request("https://metfix.org/api/directory/gyms"),
      env({}),
      undefined,
      { fetchImpl },
    );
    expect(res.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await res.text()).not.toContain("secret");
  });

  it("clinics are public and do not send a map secret", async () => {
    const urls: string[] = [];
    const res = await handleDirectoryRoutes(
      new Request("https://metfix.org/api/directory/clinics"),
      env({ BSI_AFFILIATES_MAP_SECRET: GYM_SECRET, BSI_COACHES_MAP_SECRET: COACH_SECRET }),
      undefined,
      {
        fetchImpl: async (input) => {
          const url = String(input);
          urls.push(url);
          return jsonResponse({
            items: [
              {
                affiliate_id: 3,
                affiliate_name: "Front Range Metabolic",
                lat: 39.7,
                lng: -104.9,
                city: "Denver",
                state_abbr: "CO",
              },
            ],
            find_a_doctor_enabled: true,
            hasMore: false,
          });
        },
      },
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(GYM_SECRET);
    expect(text).not.toContain(COACH_SECRET);
    expect(urls[0]).not.toContain("secret=");
    expect(JSON.parse(text)).toMatchObject({
      find_a_doctor_enabled: true,
      listings: [{ id: "doctor:3", kind: "doctor" }],
    });
  });

  it("coaches are 401 without a session", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const res = await handleDirectoryRoutes(
      new Request("https://metfix.org/api/directory/coaches"),
      env({ BSI_COACHES_MAP_SECRET: COACH_SECRET }),
      undefined,
      { fetchImpl },
    );
    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("coaches are 403 when the account cannot view the coach map", async () => {
    const urls: string[] = [];
    const res = await handleDirectoryRoutes(
      new Request("https://metfix.org/api/directory/coaches"),
      env({ BSI_COACHES_MAP_SECRET: COACH_SECRET }),
      undefined,
      {
        resolveSession: async () => acting(),
        fetchImpl: async (input) => {
          urls.push(String(input));
          return jsonResponse({ badges: { affiliate: "none" }, foundations_coach: {} });
        },
      },
    );
    expect(res.status).toBe(403);
    expect(urls.some((url) => url.includes("/coaches"))).toBe(false);
    expect(await res.text()).not.toContain(COACH_SECRET);
  });

  it("coaches load for an active foundations coach and hide the secret", async () => {
    const urls: string[] = [];
    const res = await handleDirectoryRoutes(
      new Request("https://metfix.org/api/directory/coaches"),
      env({ BSI_COACHES_MAP_SECRET: COACH_SECRET }),
      undefined,
      {
        resolveSession: async () => acting(),
        fetchImpl: async (input) => {
          const url = String(input);
          urls.push(url);
          if (url.includes("/me/account")) {
            return jsonResponse({
              badges: { affiliate: false },
              foundations_coach: {
                seminar_checked_in: true,
                granted_at: "2026-06-01T00:00:00.000Z",
              },
            });
          }
          return jsonResponse({
            coaches: [
              {
                member_id: 9,
                display_name: "Elena Voss",
                affiliate_name: "Harbor Strength",
                lat: 47.6,
                lng: -122.3,
                city: "Seattle",
                state_abbr: "WA",
                communities_served: [{ label: "Postpartum", value: 4 }],
              },
            ],
            has_more: false,
            secret: COACH_SECRET,
          });
        },
      },
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(COACH_SECRET);
    expect(urls.some((url) => url.includes(`secret=${COACH_SECRET}`))).toBe(true);
    expect(JSON.parse(text).listings[0]).toMatchObject({
      id: "coach:9",
      name: "Elena Voss",
      title: "MetFix Coach · Harbor Strength",
    });
  });

  it("does not forward an upstream body that contains the secret", async () => {
    const res = await handleDirectoryRoutes(
      new Request("https://metfix.org/api/directory/gyms"),
      env({ BSI_AFFILIATES_MAP_SECRET: GYM_SECRET }),
      undefined,
      {
        fetchImpl: async () => new Response(`nope ${GYM_SECRET}`, { status: 500 }),
      },
    );
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain(GYM_SECRET);
  });

  it("geocode proxies Nominatim and returns lat/lng", async () => {
    const res = await handleDirectoryRoutes(
      new Request("https://metfix.org/api/directory/geocode?q=Austin%20TX"),
      env({}),
      undefined,
      {
        fetchImpl: async (input) => {
          expect(String(input)).toContain("nominatim.openstreetmap.org");
          return jsonResponse([
            {
              lat: "30.2672",
              lon: "-97.7431",
              display_name: "Austin, Travis County, Texas, United States",
            },
          ]);
        },
      },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      found: true,
      lat: 30.2672,
      lng: -97.7431,
      label: "Austin, Travis County, Texas, United States",
    });
  });

  it("handleRequest serves /api/directory/gyms before the API catch-all", async () => {
    const cache = {
      async match() {
        return undefined;
      },
      async put() {},
    } as unknown as Cache;
    const res = await handleRequest(
      new Request("https://metfix.org/api/directory/gyms"),
      env({}),
      { waitUntil() {}, passThroughOnException() {}, props: {} },
      { fetchImpl: async () => jsonResponse({}), cachesDefault: cache },
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "unavailable" });
  });
});
