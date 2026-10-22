/**
 * Workers-runtime posts HTML tests (PH1–PH15). Requires `npm run build:cf`.
 * Run: `npm run test:workers`.
 *
 * Many PH cases are also covered in posts.test.ts via handleRequest + HTMLRewriter polyfill.
 * This file asserts real workerd HTMLRewriter + ASSETS bindings.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SELF, env, fetchMock } from "cloudflare:test";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    ASSETS: Fetcher;
    DAILY_FIX_API_KEY: string;
    BSI_POSTS_API_KEY: string;
  }
}

const BSI = "https://brokenscience.org";

function unlockedPost(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Post ${id}`,
    excerpt: "Hello world excerpt",
    date: "2026-10-19T10:00:00+00:00",
    featured_image: null,
    author: { id: 1, name: "A" },
    categories: [{ id: 1, name: "News", slug: "news" }],
    access_levels: [],
    content_access_display: {
      has_content_access: false,
      is_exclusive: false,
      access: "full",
    },
    permalink: `${BSI}/post-${id}`,
    content: `<p>Body ${id}</p>`,
    ...overrides,
  };
}

function mockBsiList(posts: unknown[], total: number) {
  fetchMock
    .get(BSI)
    .intercept({
      path: /\/wp-json\/bsi\/v1\/posts\?/,
      method: "GET",
    })
    .reply(
      200,
      JSON.stringify({
        posts,
        meta: { total, per_page: 10, has_more: false },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
}

function mockBsiDetail(id: number, post: unknown, status = 200) {
  fetchMock
    .get(BSI)
    .intercept({
      path: `/wp-json/bsi/v1/posts/${id}`,
      method: "GET",
    })
    .reply(status, JSON.stringify(status === 200 ? { post } : post), {
      headers: { "Content-Type": "application/json" },
    });
}

beforeAll(async () => {
  const asset = await env.ASSETS.fetch("https://metfix.org/", {
    headers: { Accept: "text/html" },
  });
  if (asset.status !== 200) {
    throw new Error(
      `ASSETS index returned ${asset.status} — run \`npm run build:cf\` before test:workers`,
    );
  }
});

beforeEach(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
  fetchMock.deactivate();
});

describe("PH posts HTML (pool-workers)", () => {
  it("PH1 bindings include BSI_POSTS_API_KEY (wrangler assert in build.config.test)", () => {
    expect(env.BSI_POSTS_API_KEY).toBe("test-posts-key");
    expect(env.DAILY_FIX_API_KEY).toBe("k_QA_SENT_KEY");
  });

  it("PH2 non-html Accept → ASSETS, no upstream", async () => {
    const res = await SELF.fetch("https://metfix.org/posts", {
      headers: { Accept: "application/json" },
    });
    expect(res.status).toBe(200);
  });

  it("PH3 list head exact strings on real HTMLRewriter", async () => {
    mockBsiList([unlockedPost(1)], 1);
    const res = await SELF.fetch("https://metfix.org/posts", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>Posts — MetFix</title>");
    expect(html).toContain('content="Articles from Broken Science."');
    expect(html).toContain('content="noindex, follow"');
    expect(html).toContain('content="website"');
    expect(html).toContain("https://metfix.org/social-preview.jpg");
    expect((html.match(/name="robots"/g) ?? []).length).toBe(1);
    expect((html.match(/rel="canonical"/g) ?? []).length).toBe(0);
  });

  it("PH4 invalid page → page-1 head, never 400", async () => {
    mockBsiList([unlockedPost(1)], 1);
    const res = await SELF.fetch("https://metfix.org/posts?page=abc", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>Posts — MetFix</title>");
  });

  it("PH5 detail with permalink", async () => {
    mockBsiDetail(
      5,
      unlockedPost(5, {
        title: "Hello",
        excerpt: "World",
        permalink: `${BSI}/hello`,
      }),
    );
    const res = await SELF.fetch("https://metfix.org/posts/5", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>Hello — MetFix</title>");
    expect(html).toContain('content="index, follow"');
    expect(html).toContain(`href="${BSI}/hello"`);
    expect(html).toContain('content="article"');
  });

  it("PH6 detail without valid permalink", async () => {
    mockBsiDetail(5, unlockedPost(5, { permalink: "http://brokenscience.org/x", title: "T" }));
    const html = await (
      await SELF.fetch("https://metfix.org/posts/5", { headers: { Accept: "text/html" } })
    ).text();
    expect(html).toContain('content="noindex, follow"');
    expect(html).toContain('content="https://metfix.org/posts/5"');
  });

  it("PH7 escaping on real HTMLRewriter", async () => {
    mockBsiDetail(
      5,
      unlockedPost(5, {
        title: `"><script>x</script>`,
        excerpt: `a " b < c & d`,
        permalink: null,
      }),
    );
    const html = await (
      await SELF.fetch("https://metfix.org/posts/5", { headers: { Accept: "text/html" } })
    ).text();
    expect(html).toContain("&quot;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain('"><script>x</script>');
  });

  it("PH8 og:image fallback for cdn host", async () => {
    mockBsiDetail(
      5,
      unlockedPost(5, {
        featured_image: "https://cdn.brokenscience.org/a.jpg",
        permalink: `${BSI}/x`,
      }),
    );
    const html = await (
      await SELF.fetch("https://metfix.org/posts/5", { headers: { Accept: "text/html" } })
    ).text();
    expect(html).toContain("https://metfix.org/social-preview.jpg");
    expect(html).not.toContain("cdn.brokenscience.org");
  });

  it("PH9 invalid id → 404 htmlNotFound, no upstream", async () => {
    const res = await SELF.fetch("https://metfix.org/posts/abc", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(404);
  });

  it("PH9 locked detail → 404; PH14 no LOCK sentinel", async () => {
    mockBsiDetail(8, {
      ...unlockedPost(8),
      title: "LOCKED-BODY-7f3",
      excerpt: "LOCKED-EXC-7f3",
      content: "LOCKED-BODY-7f3",
      video: "LOCKED-VID-7f3",
      access_levels: ["members"],
      content_access_display: {
        has_content_access: true,
        is_exclusive: true,
        access: "preview",
      },
    });
    const res = await SELF.fetch("https://metfix.org/posts/8", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).not.toContain("LOCKED-BODY-7f3");
    expect(html).not.toContain("LOCKED-EXC-7f3");
    expect(html).not.toContain("LOCKED-VID-7f3");
  });

  it("PH10 upstream failure → 503 Retry-After 300", async () => {
    fetchMock
      .get(BSI)
      .intercept({ path: /\/wp-json\/bsi\/v1\/posts\?/, method: "GET" })
      .reply(500, "{}");
    const res = await SELF.fetch("https://metfix.org/posts", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("PH11 /posts/ → 301 /posts (query kept)", async () => {
    const res = await SELF.fetch("https://metfix.org/posts/?page=2", {
      headers: { Accept: "text/html" },
      redirect: "manual",
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/posts?page=2");
  });

  it("PH11 /posts/{id}/ → 301", async () => {
    const res = await SELF.fetch("https://metfix.org/posts/123/", {
      headers: { Accept: "text/html" },
      redirect: "manual",
    });
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/posts/123");
  });

  it("PH12 HTML then API shares one upstream", async () => {
    mockBsiDetail(5, unlockedPost(5));
    const html = await SELF.fetch("https://metfix.org/posts/5", {
      headers: { Accept: "text/html" },
    });
    expect(html.status).toBe(200);
    // Second call must not need another interceptor (cache hit).
    const api = await SELF.fetch("https://metfix.org/api/posts/5");
    expect(api.status).toBe(200);
    const body = (await api.json()) as { post: { id: number } };
    expect(body.post.id).toBe(5);
  });

  it("PH13 exactly one robots tag on list and detail", async () => {
    mockBsiList([unlockedPost(1)], 1);
    const listHtml = await (
      await SELF.fetch("https://metfix.org/posts", { headers: { Accept: "text/html" } })
    ).text();
    expect((listHtml.match(/name="robots"/g) ?? []).length).toBe(1);

    mockBsiDetail(5, unlockedPost(5));
    const detailHtml = await (
      await SELF.fetch("https://metfix.org/posts/5", { headers: { Accept: "text/html" } })
    ).text();
    expect((detailHtml.match(/name="robots"/g) ?? []).length).toBe(1);
    expect((detailHtml.match(/rel="canonical"/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("PH15 head values match Posts — MetFix / Articles from Broken Science.", async () => {
    mockBsiList([], 0);
    const html = await (
      await SELF.fetch("https://metfix.org/posts", { headers: { Accept: "text/html" } })
    ).text();
    expect(html).toContain("<title>Posts — MetFix</title>");
    expect(html).toContain("Articles from Broken Science.");
  });
});
