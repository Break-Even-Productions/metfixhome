/**
 * Real HTMLRewriter via @cloudflare/vitest-pool-workers against built dist/public.
 * Requires `npm run build:cf` first (CI runs build before test:workers).
 *
 * Node unit tests use worker/test/htmlrewriter-polyfill.ts (unit-only).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SELF, env, fetchMock } from "cloudflare:test";

declare module "cloudflare:test" {
  interface ProvidedEnv {
    ASSETS: Fetcher;
    DAILY_FIX_API_KEY: string;
  }
}

const DAY = {
  date: "2026-10-04",
  belly: {
    title: "Belly dish",
    body: "<p>Ingredients</p>",
    steps: "<p>Steps</p>",
    macros: { fat: 1, carb: 2, protein: 3 },
    photo_url: "https://cdn.example.com/belly.jpg",
    has_structured_ingredients: false,
    has_structured_steps: false,
    recipe_ingredients: [],
    recipe_steps: [],
  },
  body: {
    title: "Body work",
    body: "<p>Workout</p>",
    photo_url: "https://cdn.example.com/body.jpg",
  },
  brain: {
    title: "Brain read",
    body: "<p>Article</p>",
    photo_url: "https://cdn.example.com/brain.jpg",
  },
};

const SEO_12 = [
  /<title>/i,
  /name=["']description["']/i,
  /rel=["']canonical["']/i,
  /property=["']og:type["']/i,
  /property=["']og:title["']/i,
  /property=["']og:description["']/i,
  /property=["']og:url["']/i,
  /property=["']og:image["']/i,
  /name=["']twitter:card["']/i,
  /name=["']twitter:title["']/i,
  /name=["']twitter:description["']/i,
  /name=["']twitter:image["']/i,
];

let siteTitle = "";

function interceptDay(status = 200, body: unknown = DAY) {
  fetchMock
    .get("https://brokenscience.org")
    .intercept({ path: /\/wp-json\/metfix\/v1\/daily-fix/, method: "GET" })
    .reply(status, typeof body === "string" ? body : JSON.stringify(body), {
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
  const html = await asset.text();
  const m = html.match(/<title>([^<]*)<\/title>/i);
  if (!m) throw new Error("ASSETS index.html missing <title>");
  siteTitle = m[1]!;
});

beforeEach(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

afterEach(() => {
  fetchMock.assertNoPendingInterceptors();
  fetchMock.deactivate();
});

describe("pool-workers HTMLRewriter (built dist)", () => {
  it("dated 200: 12 tags in order once each, df-initial JSON round-trip", async () => {
    interceptDay(200, DAY);
    const res = await SELF.fetch("https://metfix.org/the-daily-fix/261004", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    const html = await res.text();

    let prev = -1;
    for (const re of SEO_12) {
      const idx = html.search(re);
      expect(idx, String(re)).toBeGreaterThan(prev);
      prev = idx;
    }
    expect((html.match(/<title>/gi) || []).length).toBe(1);
    expect((html.match(/name=["']description["']/gi) || []).length).toBe(1);
    expect((html.match(/rel=["']canonical["']/gi) || []).length).toBe(1);
    expect((html.match(/property=["']og:type["']/gi) || []).length).toBe(1);
    expect((html.match(/property=["']og:title["']/gi) || []).length).toBe(1);
    expect((html.match(/property=["']og:description["']/gi) || []).length).toBe(1);
    expect((html.match(/property=["']og:url["']/gi) || []).length).toBe(1);
    expect((html.match(/property=["']og:image(?!:)["']/gi) || []).length).toBe(1);
    expect((html.match(/name=["']twitter:card["']/gi) || []).length).toBe(1);
    expect((html.match(/name=["']twitter:title["']/gi) || []).length).toBe(1);
    expect((html.match(/name=["']twitter:description["']/gi) || []).length).toBe(1);
    expect((html.match(/name=["']twitter:image(?!:)["']/gi) || []).length).toBe(1);

    expect(html).toContain("<title>The Daily Fix - 261004</title>");
    expect(html).not.toContain("CollectionPage");

    const match = html.match(
      /<script type="application\/json" id="df-initial">([\s\S]*?)<\/script>/,
    );
    expect(match).toBeTruthy();
    expect(JSON.parse(match![1]!)).toEqual(DAY);
  });

  it("?tab=brain: title suffix, og:url has tab, canonical tab-less", async () => {
    interceptDay(200, DAY);
    const res = await SELF.fetch("https://metfix.org/the-daily-fix/261004?tab=brain", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>The Daily Fix - 261004 | Brain</title>");
    expect(html).toContain('rel="canonical" href="https://metfix.org/the-daily-fix/261004"');
    expect(html).toContain(
      'property="og:url" content="https://metfix.org/the-daily-fix/261004?tab=brain"',
    );
    expect(html).toContain("cdn.example.com/brain.jpg");
  });

  it("rest day ?tab=body: no Body suffix, tab-less og:url, belly image", async () => {
    const rest = {
      ...DAY,
      body: { title: "Rest", body: null, excerpt: "<p>Rest day</p>" },
    };
    interceptDay(200, rest);
    const res = await SELF.fetch("https://metfix.org/the-daily-fix/261004?tab=body", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<title>The Daily Fix - 261004</title>");
    expect(html).not.toContain("| Body");
    expect(html).toContain('property="og:url" content="https://metfix.org/the-daily-fix/261004"');
    expect(html).toContain("belly.jpg");
  });

  it("W29 escaping on real HTMLRewriter", async () => {
    const hostile = {
      ...DAY,
      belly: {
        ...DAY.belly,
        title: `Tom "&" <b>Jerry</b> 's &amp;#8211; x`,
      },
    };
    interceptDay(200, hostile);
    const res = await SELF.fetch("https://metfix.org/the-daily-fix/261004", {
      headers: { Accept: "text/html" },
    });
    const html = await res.text();
    const escaped = "Tom &quot;&amp;&quot; Jerry &#39;s &amp;#8211; x";
    expect(html).toContain(escaped);
    expect(html).toMatch(
      new RegExp(`name="description" content="[^"]*${escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    expect(html).not.toMatch(/description[^>]*<b>/);
  });

  it("W30 df-initial escaping </script> and U+2028 on real HTMLRewriter", async () => {
    const raw = {
      ...DAY,
      belly: {
        ...DAY.belly,
        body: `</script><\u2028&\u2029>`,
      },
    };
    interceptDay(200, raw);
    const res = await SELF.fetch("https://metfix.org/the-daily-fix/261004", {
      headers: { Accept: "text/html" },
    });
    const html = await res.text();
    const match = html.match(
      /<script type="application\/json" id="df-initial">([\s\S]*?)<\/script>/,
    );
    expect(match).toBeTruthy();
    const text = match![1]!;
    expect(text).toContain("\\u003c");
    expect(text).toContain("\\u003e");
    expect(text).toContain("\\u0026");
    expect(text).toContain("\\u2028");
    expect(text).toContain("\\u2029");
    expect(JSON.parse(text)).toEqual(raw);
    expect(text).not.toContain("</script>");
  });

  it("404: noindex, site title, no canonical", async () => {
    interceptDay(404, "{}");
    const res = await SELF.fetch("https://metfix.org/the-daily-fix/261004", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).toContain(`<title>${siteTitle}</title>`);
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("df-initial");
  });

  it("503: site title, Retry-After 300", async () => {
    interceptDay(500, "x");
    const res = await SELF.fetch("https://metfix.org/the-daily-fix/261004", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("300");
    const html = await res.text();
    expect(html).toContain(`<title>${siteTitle}</title>`);
    expect(html).not.toContain("df-initial");
    expect(html).not.toContain('rel="canonical"');
  });

  it("HEAD: same headers as GET, empty body", async () => {
    // One upstream fetch; HEAD reuses the edge cache entry from GET.
    interceptDay(200, DAY);
    const get = await SELF.fetch("https://metfix.org/the-daily-fix/261004", {
      headers: { Accept: "text/html" },
    });
    const head = await SELF.fetch("https://metfix.org/the-daily-fix/261004", {
      method: "HEAD",
      headers: { Accept: "text/html" },
    });
    expect(head.status).toBe(get.status);
    const getHeaders: Record<string, string> = {};
    const headHeaders: Record<string, string> = {};
    for (const [k, v] of get.headers) {
      if (k === "content-length" || k === "date") continue;
      getHeaders[k] = v;
    }
    for (const [k, v] of head.headers) {
      if (k === "content-length" || k === "date") continue;
      headHeaders[k] = v;
    }
    expect(headHeaders).toEqual(getHeaders);
    expect(await head.text()).toBe("");
  });
});
