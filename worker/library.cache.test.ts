import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActingContext } from "./auth/acting";
import { SID_COOKIE } from "./auth/cookies";
import type { SessionRecord } from "./do/session";
import { libraryDetailCacheKey } from "../shared/library";
import { installHtmlRewriterPolyfill } from "./test/htmlrewriter-polyfill";

installHtmlRewriterPolyfill();

const state = vi.hoisted(() => ({
  acting: null as ActingContext | null,
}));

vi.mock("./auth/acting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth/acting")>();
  return {
    ...actual,
    resolveActingSession: vi.fn(async () => {
      if (!state.acting) {
        return new Response(JSON.stringify({ error: "signed_out" }), {
          status: 401,
        });
      }
      return state.acting;
    }),
    runUserBsiCall: vi.fn(async (ctx, _env, _fetchImpl, _opts, fn) => {
      const result = await fn(ctx.access);
      return { result };
    }),
  };
});

import { handleLibraryApi, handleLibraryHtml } from "./library";
import type { Env } from "./upstream";

const ITEM = "https://metfix.org/api/library/item/post/39096";
const PREVIEW_LINK =
  "https://brokenscience.org/metabolic-treatment-of-cancer-preview/";
const FULL_LINK = "https://brokenscience.org/metabolic-treatment-of-cancer/";

function actingFor(access: string, hex: string, userId = "42"): ActingContext {
  const record: SessionRecord = {
    bsi_access: access,
    bsi_refresh: "refresh",
    access_exp: Date.now() + 3_600_000,
    user_public_name: "Member",
    bsi_user_id: userId,
    can_moderate: false,
    created: Date.now(),
    last_seen: Date.now(),
  };
  return { sid: hex, hex, access, record };
}

function postPayload(member: boolean) {
  return {
    id: 39096,
    title: member ? "MEMBER TITLE" : "ANON TITLE",
    date: "2024-01-01T00:00:00.000Z",
    permalink: PREVIEW_LINK,
    excerpt: "",
    content: member
      ? '<a href="https://brokenscience.org/metabolic-treatment-of-cancer/">Full Video (members only)</a>'
      : "<p>ANON TEASER abbreviated version</p>",
    video: {
      type: "YouTube",
      url: "https://www.youtube.com/watch?v=ssx-qq29IYo",
      embed_url: "https://www.youtube.com/embed/ssx-qq29IYo",
      video_id: "ssx-qq29IYo",
    },
    full_permalink: FULL_LINK,
    full_content: "<p>MEMBER BODY of the exclusive discussion.</p>",
    full_video: {
      type: "Vimeo",
      url: "https://vimeo.com/987654321",
      embed_url: "https://player.vimeo.com/video/987654321",
      video_id: "987654321",
    },
    content_access_display: {
      access: member ? "full" : "preview",
      has_content_access: true,
      user_has_access: member,
      has_preview: true,
      is_exclusive: true,
      show_same: 0,
      show_video_in_preview: true,
      access_group_labels: ["Medical Society"],
    },
  };
}

function memoryCache(): Cache & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    match: async (req: RequestInfo | URL) => {
      const key =
        typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
      const hit = store.get(key);
      return hit ? hit.clone() : undefined;
    },
    put: async (req: RequestInfo | URL, res: Response) => {
      const key =
        typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
      store.set(key, res.clone());
    },
    delete: async () => false,
    keys: async () => [] as unknown as ReadonlyArray<Request>,
  } as Cache & { store: Map<string, Response> };
}

describe("library item cache split", () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];

  function env(): Env {
    return { BSI_POSTS_API_KEY: "test-key" } as Env;
  }

  function ctx(): ExecutionContext {
    return {
      waitUntil(p: Promise<unknown>) {
        void p;
      },
      passThroughOnException() {},
      props: {},
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    state.acting = null;
    calls.length = 0;
  });

  function fetchImpl() {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const headers = new Headers(init?.headers);
      calls.push({ url, authorization: headers.get("Authorization") });
      const member = (headers.get("Authorization") ?? "").startsWith("Bearer ");
      return new Response(JSON.stringify(postPayload(member)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  }

  it("does not serve an anon cache entry to a signed-in member or after a new session", async () => {
    const cache = memoryCache();
    const impl = fetchImpl();
    const run = (cookie?: string) =>
      handleLibraryApi(
        new Request(ITEM, {
          headers: cookie ? { Cookie: cookie } : undefined,
        }),
        env(),
        ctx(),
        { fetchImpl: impl, cachesDefault: cache },
      );

    const anon = await run();
    expect(anon.status).toBe(200);
    expect(anon.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(anon.headers.get("Vary")).toBe("Cookie");
    const anonBody = (await anon.json()) as {
      resource: { content: string; video: { kind: string; videoId: string } | null; permalink: string };
    };
    expect(anonBody.resource.content).toContain("ANON TEASER");
    expect(anonBody.resource.content).not.toContain("MEMBER BODY");
    expect(anonBody.resource.video).toMatchObject({
      kind: "youtube",
      videoId: "ssx-qq29IYo",
    });
    expect(anonBody.resource.permalink).toBe(PREVIEW_LINK);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.authorization).toBeNull();

    state.acting = actingFor("member-token-one", "sessionhexone");
    const member = await run(`${SID_COOKIE}=session-a`);
    expect(member.headers.get("Cache-Control")).toBe("private, no-store");
    expect(member.headers.get("Vary")).toBe("Cookie");
    const memberBody = (await member.json()) as {
      resource: { content: string; video: { kind: string; videoId: string } | null; permalink: string };
    };
    expect(memberBody.resource.content).toContain("MEMBER BODY");
    expect(memberBody.resource.content).not.toContain("members only");
    expect(memberBody.resource.video).toMatchObject({
      kind: "vimeo",
      videoId: "987654321",
    });
    expect(memberBody.resource.permalink).toBe(FULL_LINK);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.authorization).toBe("Bearer member-token-one");

    const again = await run(`${SID_COOKIE}=session-a`);
    expect((await again.json()) as { resource: { content: string } }).toBeTruthy();
    expect(calls).toHaveLength(2);

    state.acting = actingFor("member-token-two", "sessionhextwo");
    const nextSession = await run(`${SID_COOKIE}=session-b`);
    const nextBody = (await nextSession.json()) as {
      resource: { video: { videoId: string } | null };
    };
    expect(nextBody.resource.video?.videoId).toBe("987654321");
    expect(calls).toHaveLength(3);
    expect(calls[2]?.authorization).toBe("Bearer member-token-two");

    state.acting = null;
    const loggedOut = await run();
    const loggedOutBody = (await loggedOut.json()) as {
      resource: { content: string; video: { videoId: string } | null };
    };
    expect(loggedOutBody.resource.content).toContain("ANON TEASER");
    expect(loggedOutBody.resource.content).not.toContain("MEMBER BODY");
    expect(loggedOutBody.resource.video?.videoId).toBe("ssx-qq29IYo");
    expect(calls).toHaveLength(3);

    const keys = [...cache.store.keys()];
    expect(keys.some((key) => key.includes("/anon/"))).toBe(true);
    const memberKeys = keys.filter((key) => !key.includes("/anon/"));
    expect(memberKeys.length).toBe(2);
    for (const key of memberKeys) {
      expect(key).toContain("u42.s");
      expect(key).toContain(".e");
      expect(key).not.toContain("member-token-one");
      expect(key).not.toContain("member-token-two");
    }
    expect(new Set(memberKeys).size).toBe(2);
  });

  it("does not read or overwrite the anon entry when a session cookie does not resolve", async () => {
    const cache = memoryCache();
    const anonKey = libraryDetailCacheKey("post", "39096", null);
    const marker = JSON.stringify({
      resource: {
        id: 39096,
        type: "post",
        title: "STALE ANON MARKER",
        content: "stale teaser",
        locked: false,
        video: null,
        topics: [],
        categories: [],
        content_types: [],
      },
    });
    await cache.put(
      anonKey,
      new Response(marker, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Library-Fresh-Until": new Date(Date.now() + 60_000).toISOString(),
        },
      }),
    );

    const res = await handleLibraryApi(
      new Request(ITEM, { headers: { Cookie: `${SID_COOKIE}=unresolved` } }),
      env(),
      ctx(),
      { fetchImpl: fetchImpl(), cachesDefault: cache },
    );
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
    const body = (await res.json()) as { resource: { title: string; content: string } };
    expect(body.resource.title).toBe("ANON TITLE");
    expect(body.resource.content).not.toContain("STALE ANON MARKER");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.authorization).toBeNull();

    const stored = await cache.match(anonKey);
    expect(await stored?.text()).toBe(marker);
    expect([...cache.store.keys()]).toEqual([anonKey.url]);
  });
});

describe("library HTML cache", () => {
  it("varies on Cookie and does not publicly cache a signed-in document", async () => {
    const shell = "<!doctype html><html><head><title>MetFix</title></head><body><div id=\"root\"></div></body></html>";
    const assetsFetch = vi.fn(async () => new Response(shell, { status: 200 }));
    const env = {
      ASSETS: { fetch: assetsFetch },
      BSI_POSTS_API_KEY: "test-key",
    } as unknown as Env;
    const ctx = {
      waitUntil() {},
      passThroughOnException() {},
      props: {},
    } as unknown as ExecutionContext;

    const cachesDefault = {
      match: async () => undefined,
      put: async () => {},
    } as unknown as Cache;
    const anon = await handleLibraryHtml(
      new Request("https://metfix.org/library"),
      env,
      ctx,
      { cachesDefault },
    );
    expect(anon.status).toBe(200);
    expect(anon.headers.get("Vary")).toBe("Cookie");
    expect(anon.headers.get("Cache-Control")).toBe("public, max-age=60");

    const member = await handleLibraryHtml(
      new Request("https://metfix.org/library", {
        headers: { Cookie: `${SID_COOKIE}=session-a` },
      }),
      env,
      ctx,
      { cachesDefault },
    );
    expect(member.headers.get("Vary")).toBe("Cookie");
    expect(member.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
