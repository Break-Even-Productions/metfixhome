import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const distPublic = path.join(repoRoot, "dist", "public");
const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

const INDEX_LOCS = [
  "https://metfix.org/sitemap-pages.xml",
  "https://metfix.org/sitemap-daily-fix.xml",
];

const PAGES: { loc: string; changefreq: string; priority: string; lastmod: null }[] = [
  { loc: "https://metfix.org/", changefreq: "weekly", priority: "1.0", lastmod: null },
  { loc: "https://metfix.org/become-an-affiliate", changefreq: "weekly", priority: "0.9", lastmod: null },
  { loc: "https://metfix.org/classes", changefreq: "weekly", priority: "0.8", lastmod: null },
  { loc: "https://metfix.org/affiliate-seminars", changefreq: "weekly", priority: "0.8", lastmod: null },
  { loc: "https://metfix.org/llms.txt", changefreq: "monthly", priority: "0.3", lastmod: null },
  { loc: "https://metfix.org/llms-full.txt", changefreq: "monthly", priority: "0.3", lastmod: null },
];

/** Exact robots.txt from main 9f7129d7 (md5 c951c63f4a5a7182a18456957b26e58e). */
const ROBOTS_MAIN = `# Allow search and answer-engine crawlers
User-agent: *
Allow: /

# Common AI / answer-engine bots (explicit allow)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bytespider
Allow: /

# AI discoverability
# llms.txt: https://metfix.org/llms.txt
# llms-full.txt: https://metfix.org/llms-full.txt

Sitemap: https://metfix.org/sitemap.xml
`;

/** Routes pinned to client/src/App.tsx on main 9f7129d72c81cbb3dd70e62becf3692be1301e02. */
const SPA_ROUTES = [
  "/",
  "/become-an-affiliate",
  "/classes",
  "/courses",
  "/affiliate-seminars",
  "/the-daily-fix",
];

const STATIC_ALLOW = new Set([
  "client/public/sitemap.xml",
  "client/public/sitemap-pages.xml",
  "client/public/robots.txt",
  "client/public/_redirects",
]);
const TEST_FILE = /^tests\/sitemap-index[^/]*\.test\.ts$/;
const CI_FILE = ".github/workflows/ci.yml";
const B7_FILE = "worker/build.config.test.ts";
/** Timeout slice folded into this PR (#8). Exact paths only. */
const TIMEOUT_ALLOW = new Set([
  "docs/metfix-sitemap-timeout/metfix-sitemap-timeout-acceptance.md",
  "docs/metfix-sitemap-timeout/metfix-sitemap-timeout-tests.md",
  "shared/daily-fix/cacheTtl.ts",
  "worker/index.ts",
  "worker/index.test.ts",
  "worker/upstream.ts",
  "worker/sitemap.timeout.test.ts",
  "worker/sitemap.workers.test.ts",
]);
const WORKER_TEST = /^worker\/.*\.test\.ts$/;

function readDist(name: string): string {
  const file = path.join(distPublic, name);
  if (!existsSync(file)) {
    throw new Error(`${file} is missing — run vite build / npm run build:cf first`);
  }
  return readFileSync(file, "utf8");
}

const xmlWindows = new WeakMap<Document, Window>();

function parseXml(xml: string): Document {
  const window = new JSDOM("").window;
  const doc = new window.DOMParser().parseFromString(xml, "application/xml");
  xmlWindows.set(doc, window);
  return doc;
}

function commentCount(doc: Document): number {
  const view = xmlWindows.get(doc);
  if (!view) throw new Error("XML document has no parser window");
  const walker = doc.createTreeWalker(doc, view.NodeFilter.SHOW_COMMENT);
  let n = 0;
  while (walker.nextNode()) n += 1;
  return n;
}

function elementChildren(el: Element): Element[] {
  return [...el.childNodes].filter((node): node is Element => node.nodeType === 1);
}

function textOf(el: Element, localName: string): string | null {
  const found = el.getElementsByTagNameNS(NS, localName);
  if (found.length === 0) return null;
  return found[0]!.textContent?.trim() ?? null;
}

function stripJsonc(input: string): string {
  let out = "";
  let i = 0;
  let inString = false;
  let quote = "";
  while (i < input.length) {
    const c = input[i]!;
    const n = input[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") {
        if (n !== undefined) out += n;
        i += 2;
        continue;
      }
      if (c === quote) inString = false;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      out += c;
      i += 1;
      continue;
    }
    if (c === "/" && n === "/") {
      while (i < input.length && input[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function workerFirstPatterns(): string[] {
  const raw = readFileSync(path.join(repoRoot, "wrangler.jsonc"), "utf8");
  const json = JSON.parse(stripJsonc(raw)) as { assets?: { run_worker_first?: unknown } };
  const list = json.assets?.run_worker_first;
  if (!Array.isArray(list) || list.some((item) => typeof item !== "string")) {
    throw new Error("wrangler.jsonc assets.run_worker_first is not a string array");
  }
  return list as string[];
}

function matchesWorkerPattern(requestPath: string, pattern: string): boolean {
  const star = pattern.indexOf("*");
  if (star === -1) return requestPath === pattern;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (suffix.includes("*")) return false;
  return (
    requestPath.startsWith(prefix) &&
    requestPath.endsWith(suffix) &&
    requestPath.length >= prefix.length + suffix.length
  );
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

/** PR runs pass github.event.pull_request.base.sha. Local runs use origin/main. */
function diffBase(): string {
  const sha = process.env.PR_BASE_SHA?.trim();
  if (sha) return sha;
  return "origin/main";
}

function changedPaths(): string[] {
  const chunks = [
    git(["diff", "--name-only", `${diffBase()}...HEAD`]),
    git(["diff", "--name-only", "HEAD"]),
    git(["diff", "--name-only", "--cached"]),
    git(["ls-files", "--others", "--exclude-standard"]),
  ];
  return [...new Set(chunks.flatMap((chunk) => chunk.split("\n").map((line) => line.trim()).filter(Boolean)))];
}

function redirectRules(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => line.split(/\s+/));
}

describe("sitemap index build", () => {
  it("T1 index is well-formed", () => {
    const doc = parseXml(readDist("sitemap.xml"));
    expect(doc.getElementsByTagName("parsererror").length).toBe(0);
  });

  it("T2 index root and namespace", () => {
    const doc = parseXml(readDist("sitemap.xml"));
    expect(doc.documentElement.localName).toBe("sitemapindex");
    expect(doc.documentElement.namespaceURI).toBe(NS);
  });

  it("T3 index children", () => {
    const doc = parseXml(readDist("sitemap.xml"));
    const maps = doc.getElementsByTagNameNS(NS, "sitemap");
    expect(maps.length).toBe(2);
    const rootKids = elementChildren(doc.documentElement);
    expect(rootKids.length).toBe(2);
    expect(rootKids.every((el) => el.localName === "sitemap" && el.namespaceURI === NS)).toBe(true);
    for (const map of maps) {
      expect(map.getElementsByTagNameNS(NS, "loc").length).toBe(1);
    }
  });

  it("T4 index loc set equality", () => {
    const doc = parseXml(readDist("sitemap.xml"));
    const locs = [...doc.getElementsByTagNameNS(NS, "loc")].map((el) => (el.textContent ?? "").trim());
    expect(locs.length).toBe(2);
    expect(new Set(locs).size).toBe(2);
    expect([...locs].sort()).toEqual([...INDEX_LOCS].sort());
  });

  it("T5 index URL hygiene", () => {
    const doc = parseXml(readDist("sitemap.xml"));
    const locs = [...doc.getElementsByTagNameNS(NS, "loc")].map((el) => (el.textContent ?? "").trim());
    for (const loc of locs) {
      const u = new URL(loc);
      expect(u.protocol).toBe("https:");
      expect(u.hostname).toBe("metfix.org");
      expect(u.port).toBe("");
      expect(u.username).toBe("");
      expect(u.password).toBe("");
      expect(u.search).toBe("");
      expect(u.hash).toBe("");
      const authority = loc.slice(loc.indexOf("://") + 3).split(/[/?#]/)[0];
      expect(authority).toBe("metfix.org");
    }
  });

  it("T6 index has no comments, lastmod, or urlset", () => {
    const doc = parseXml(readDist("sitemap.xml"));
    expect(commentCount(doc)).toBe(0);
    expect(doc.getElementsByTagNameNS(NS, "lastmod").length).toBe(0);
    expect(doc.getElementsByTagNameNS(NS, "urlset").length).toBe(0);
  });

  it("T7 pages sitemap is a comment-free urlset", () => {
    const doc = parseXml(readDist("sitemap-pages.xml"));
    expect(doc.getElementsByTagName("parsererror").length).toBe(0);
    expect(doc.documentElement.localName).toBe("urlset");
    expect(doc.documentElement.namespaceURI).toBe(NS);
    expect(commentCount(doc)).toBe(0);
  });

  it("T8 pages snapshot set equality and order", () => {
    const doc = parseXml(readDist("sitemap-pages.xml"));
    const urls = [...doc.getElementsByTagNameNS(NS, "url")];
    const tuples = urls.map((url) => ({
      loc: textOf(url, "loc"),
      changefreq: textOf(url, "changefreq"),
      priority: textOf(url, "priority"),
      lastmod: textOf(url, "lastmod"),
    }));
    expect(tuples.length).toBe(6);
    const serialized = tuples.map((tuple) => JSON.stringify(tuple));
    expect(new Set(serialized).size).toBe(6);
    expect(serialized.sort()).toEqual(PAGES.map((page) => JSON.stringify(page)).sort());
    expect(tuples.every((tuple) => tuple.lastmod === null)).toBe(true);
    expect(tuples.map((tuple) => tuple.loc), "T8 order").toEqual(PAGES.map((page) => page.loc));
  });

  it("T9 robots sitemap lines", () => {
    const lines = readDist("robots.txt").split("\n");
    expect(lines.filter((line) => line === "Sitemap: https://metfix.org/sitemap.xml").length).toBe(1);
    expect(lines.filter((line) => line === "Sitemap: https://metfix.org/sitemap-daily-fix.xml").length).toBe(1);
    const index = lines.indexOf("Sitemap: https://metfix.org/sitemap.xml");
    expect(lines[index + 1]).toBe("Sitemap: https://metfix.org/sitemap-daily-fix.xml");
  });

  it("T10 robots otherwise byte-equal to main", () => {
    const built = readDist("robots.txt");
    const daily = "Sitemap: https://metfix.org/sitemap-daily-fix.xml\n";
    expect(built.split(daily).length).toBe(2);
    expect(built.replace(daily, "")).toBe(ROBOTS_MAIN);
  });

  it("T11 _redirects is in dist", () => {
    expect(existsSync(path.join(distPublic, "_redirects"))).toBe(true);
  });

  it("T12 _redirects has exactly one rule", () => {
    expect(redirectRules(readDist("_redirects"))).toEqual([["/sitemap_index.xml", "/sitemap.xml", "301"]]);
  });

  it("T23 every loc resolves", () => {
    const index = parseXml(readDist("sitemap.xml"));
    const indexLocs = [...index.getElementsByTagNameNS(NS, "loc")].map((el) => (el.textContent ?? "").trim());
    const patterns = workerFirstPatterns();
    for (const loc of indexLocs) {
      const pathname = new URL(loc).pathname;
      if (pathname === "/sitemap-pages.xml") {
        expect(existsSync(path.join(distPublic, "sitemap-pages.xml"))).toBe(true);
      } else if (pathname === "/sitemap-daily-fix.xml") {
        expect(patterns).toContain("/sitemap-daily-fix.xml");
      } else {
        throw new Error(`unexpected index loc ${loc}`);
      }
    }
    const pages = parseXml(readDist("sitemap-pages.xml"));
    const pageLocs = [...pages.getElementsByTagNameNS(NS, "url")].map((url) => textOf(url, "loc"));
    for (const loc of pageLocs) {
      const pathname = new URL(loc!).pathname;
      const file = pathname === "/" ? null : path.join(distPublic, pathname.replace(/^\//, ""));
      const fileExists = file !== null && existsSync(file) && !file.endsWith("/");
      const knownRoute = SPA_ROUTES.includes(pathname);
      expect(fileExists || knownRoute, pathname).toBe(true);
      expect(pathname).not.toBe("/404");
    }
  });

  it("T24 _redirects does not name a run_worker_first path", () => {
    const patterns = workerFirstPatterns();
    const rules = redirectRules(readDist("_redirects"));
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const [source, destination] = rule;
      for (const pattern of patterns) {
        expect(matchesWorkerPattern(source!, pattern), `${source} ~ ${pattern}`).toBe(false);
        expect(matchesWorkerPattern(destination!, pattern), `${destination} ~ ${pattern}`).toBe(false);
      }
    }
  });

  it("T19 diff is limited to the sitemap allowlist", () => {
    const names = changedPaths();
    for (const name of names) {
      const allowed =
        STATIC_ALLOW.has(name) ||
        TEST_FILE.test(name) ||
        name === CI_FILE ||
        name === B7_FILE ||
        TIMEOUT_ALLOW.has(name);
      expect(allowed, name).toBe(true);
      expect(name).not.toBe("wrangler.jsonc");
      const workerOk = name === B7_FILE || TIMEOUT_ALLOW.has(name) || !name.startsWith("worker/");
      expect(workerOk, name).toBe(true);
      expect(name).not.toBe("client/public/_headers");
    }
  });

  it("T20 diff has no production test hooks", () => {
    const prod = [
      ".",
      ":(exclude)tests",
      ":(exclude)docs",
      ":(exclude)worker/*.test.ts",
      `:(exclude)${B7_FILE}`,
    ];
    const diffText = [
      git(["diff", `${diffBase()}...HEAD`, "--", ...prod]),
      git(["diff", "HEAD", "--", ...prod]),
      git(["diff", "--cached", "--", ...prod]),
    ].join("\n");
    const added = diffText
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .join("\n");
    expect(added).not.toMatch(/ForTests|forTests|onlyForTests|__testOnly|testOnlyHook/);
    expect(added).not.toMatch(/\bvi\.mock\b/);
    expect(added).not.toMatch(/cloudflare:test/);
    const workerPaths = [...diffText.matchAll(/^diff --git a\/(\S+) b\//gm)]
      .map((match) => match[1]!)
      .filter((file) => file.startsWith("worker/"));
    for (const file of workerPaths) {
      expect(TIMEOUT_ALLOW.has(file) && !WORKER_TEST.test(file), file).toBe(true);
    }
    expect(diffText).not.toMatch(/^diff --git a\/wrangler\.jsonc/m);
    const ciDiff = git(["diff", `${diffBase()}...HEAD`, "--", CI_FILE]) + git(["diff", "HEAD", "--", CI_FILE]);
    const ciAdded = ciDiff
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .join("\n");
    expect(ciAdded).not.toMatch(/CLOUDFLARE_API_TOKEN/);
    expect(ciAdded).not.toMatch(/secrets\./);
    expect(ciAdded).not.toMatch(/wrangler login/);
    expect(ciAdded).not.toMatch(/--remote/);
  });
});
