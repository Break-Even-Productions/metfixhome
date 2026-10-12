import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeDailyFixPath } from "./normalizePath";
import { normalizeDailyFixPath as clientNormalize } from "../../client/src/pages/the-daily-fix/model";

type Row = {
  name: string;
  path: string;
  expect:
    | { kind: "serve"; mode: "bare"; tab?: "body" | "brain" | null }
    | { kind: "serve"; mode: "dated"; iso: string; yymmdd: string; tab?: "body" | "brain" | null }
    | { kind: "redirect"; location: string }
    | { kind: "notFound" };
};

const ROWS: Row[] = [
  { name: "bare", path: "/the-daily-fix", expect: { kind: "serve", mode: "bare", tab: null } },
  {
    name: "dated yymmdd",
    path: "/the-daily-fix/261004",
    expect: { kind: "serve", mode: "dated", iso: "2026-10-04", yymmdd: "261004", tab: null },
  },
  {
    name: "YY/MM/DD",
    path: "/the-daily-fix/26/10/04",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "YYYYMMDD",
    path: "/the-daily-fix/20261004",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "YYYY-MM-DD",
    path: "/the-daily-fix/2026-10-04",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "path pillar brain",
    path: "/the-daily-fix/261004/brain",
    expect: { kind: "redirect", location: "/the-daily-fix/261004?tab=brain" },
  },
  {
    name: "path pillar body",
    path: "/the-daily-fix/261004/body",
    expect: { kind: "redirect", location: "/the-daily-fix/261004?tab=body" },
  },
  {
    name: "path pillar belly",
    path: "/the-daily-fix/261004/belly",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "leap day 280229",
    path: "/the-daily-fix/280229",
    expect: { kind: "serve", mode: "dated", iso: "2028-02-29", yymmdd: "280229", tab: null },
  },
  { name: "invalid leap 270229", path: "/the-daily-fix/270229", expect: { kind: "notFound" } },
  { name: "260231", path: "/the-daily-fix/260231", expect: { kind: "notFound" } },
  { name: "261301", path: "/the-daily-fix/261301", expect: { kind: "notFound" } },
  { name: "261000", path: "/the-daily-fix/261000", expect: { kind: "notFound" } },
  { name: "4 segments", path: "/the-daily-fix/26/10/04/x", expect: { kind: "notFound" } },
  { name: "non-2-digit slash 26/1/04", path: "/the-daily-fix/26/1/04", expect: { kind: "notFound" } },
  { name: "non-2-digit 026/10/04", path: "/the-daily-fix/026/10/04", expect: { kind: "notFound" } },
  { name: "year 1999 8-digit", path: "/the-daily-fix/19991004", expect: { kind: "notFound" } },
  { name: "year 2100 8-digit", path: "/the-daily-fix/21001004", expect: { kind: "notFound" } },
  { name: "year 1999 hyphen", path: "/the-daily-fix/1999-10-04", expect: { kind: "notFound" } },
  { name: "year 2100 hyphen", path: "/the-daily-fix/2100-10-04", expect: { kind: "notFound" } },
  {
    name: "year 2000 8-digit",
    path: "/the-daily-fix/20001004",
    expect: { kind: "redirect", location: "/the-daily-fix/001004" },
  },
  {
    name: "year 2099 8-digit",
    path: "/the-daily-fix/20991004",
    expect: { kind: "redirect", location: "/the-daily-fix/991004" },
  },
  {
    name: "year 2000 hyphen",
    path: "/the-daily-fix/2000-10-04",
    expect: { kind: "redirect", location: "/the-daily-fix/001004" },
  },
  {
    name: "year 2099 hyphen",
    path: "/the-daily-fix/2099-10-04",
    expect: { kind: "redirect", location: "/the-daily-fix/991004" },
  },
  { name: "26/02/31 invalid", path: "/the-daily-fix/26/02/31", expect: { kind: "notFound" } },
  { name: "7-digit segment", path: "/the-daily-fix/2610040", expect: { kind: "notFound" } },
  {
    name: "unknown path pillar",
    path: "/the-daily-fix/261004/foo",
    expect: { kind: "notFound" },
  },
  {
    name: "trailing slash bare",
    path: "/the-daily-fix/",
    expect: { kind: "redirect", location: "/the-daily-fix" },
  },
  {
    name: "trailing slash dated",
    path: "/the-daily-fix/261004/",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "one-hop ISO+brain",
    path: "/the-daily-fix/2026-10-04/brain",
    expect: { kind: "redirect", location: "/the-daily-fix/261004?tab=brain" },
  },
];

const TAB_ROWS: Array<{ name: string; path: string; search: string; expect: Row["expect"] }> = [
  {
    name: "tab belly",
    path: "/the-daily-fix/261004",
    search: "?tab=belly",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "tab xyz",
    path: "/the-daily-fix/261004",
    search: "?tab=xyz",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "tab empty",
    path: "/the-daily-fix/261004",
    search: "?tab=",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "tab repeated",
    path: "/the-daily-fix/261004",
    search: "?tab=body&tab=brain",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "tab array",
    path: "/the-daily-fix/261004",
    search: "?tab[]=body",
    expect: { kind: "redirect", location: "/the-daily-fix/261004" },
  },
  {
    name: "tab BRAIN",
    path: "/the-daily-fix/261004",
    search: "?tab=BRAIN",
    expect: { kind: "redirect", location: "/the-daily-fix/261004?tab=brain" },
  },
  {
    name: "tab Body",
    path: "/the-daily-fix/261004",
    search: "?tab=Body",
    expect: { kind: "redirect", location: "/the-daily-fix/261004?tab=body" },
  },
  {
    name: "tab %62ody → 301",
    path: "/the-daily-fix/261004",
    search: "?tab=%62ody",
    expect: { kind: "redirect", location: "/the-daily-fix/261004?tab=body" },
  },
  {
    name: "tab body serve",
    path: "/the-daily-fix/261004",
    search: "?tab=body",
    expect: { kind: "serve", mode: "dated", iso: "2026-10-04", yymmdd: "261004", tab: "body" },
  },
  {
    name: "tab body with other params",
    path: "/the-daily-fix/261004",
    search: "?x=1&tab=body&y=2",
    expect: { kind: "serve", mode: "dated", iso: "2026-10-04", yymmdd: "261004", tab: "body" },
  },
  {
    name: "bare tab brain serve",
    path: "/the-daily-fix",
    search: "?tab=brain",
    expect: { kind: "serve", mode: "bare", tab: "brain" },
  },
  {
    name: "bare tab xyz strip",
    path: "/the-daily-fix",
    search: "?tab=xyz",
    expect: { kind: "redirect", location: "/the-daily-fix" },
  },
];

function withQuery(location: string, extra: string): string {
  if (!extra) return location;
  const q = extra.startsWith("?") ? extra.slice(1) : extra;
  if (!q) return location;
  return location.includes("?") ? `${location}&${q}` : `${location}?${q}`;
}

describe("S1 normalizeDailyFixPath table", () => {
  const queries = ["", "?x=1", "?a=%2F&b=c+d"];

  for (const row of ROWS) {
    for (const q of queries) {
      it(`${row.name} with ${q || "(no query)"}`, () => {
        const result = normalizeDailyFixPath(row.path, q);
        if (row.expect.kind === "redirect") {
          let expectedLoc = row.expect.location;
          if (q) {
            const isPillarRedirect = /\/(belly|body|brain)$/.test(row.path);
            if (isPillarRedirect) {
              // Existing query first; tab (if any) stays last (Q10).
              const tabMatch = expectedLoc.match(/\?tab=(body|brain)$/);
              const base = expectedLoc.replace(/\?tab=(body|brain)$/, "");
              const qBody = q.startsWith("?") ? q.slice(1) : q;
              expectedLoc = tabMatch
                ? `${base}?${qBody}&tab=${tabMatch[1]}`
                : `${base}?${qBody}`;
            } else {
              expectedLoc = withQuery(expectedLoc, q);
            }
          }
          expect(result).toEqual({ kind: "redirect", location: expectedLoc });
        } else if (row.expect.kind === "notFound") {
          expect(result).toEqual({ kind: "notFound" });
        } else if (row.expect.mode === "bare") {
          expect(result).toMatchObject({
            kind: "serve",
            mode: "bare",
            tab: row.expect.tab ?? null,
          });
        } else {
          expect(result).toMatchObject({
            kind: "serve",
            mode: "dated",
            iso: row.expect.iso,
            yymmdd: row.expect.yymmdd,
            tab: row.expect.tab ?? null,
          });
        }
      });
    }
  }

  for (const row of TAB_ROWS) {
    it(row.name, () => {
      expect(normalizeDailyFixPath(row.path, row.search)).toEqual(row.expect);
    });
  }

  it("keeps other pairs byte-for-byte when lowercasing BRAIN", () => {
    expect(normalizeDailyFixPath("/the-daily-fix/261004", "?a=%2F&tab=BRAIN&b=c+d")).toEqual({
      kind: "redirect",
      location: "/the-daily-fix/261004?a=%2F&tab=brain&b=c+d",
    });
  });

  it("path pillar appends tab last when query exists (Q10)", () => {
    expect(normalizeDailyFixPath("/the-daily-fix/261004/brain", "?x=1")).toEqual({
      kind: "redirect",
      location: "/the-daily-fix/261004?x=1&tab=brain",
    });
  });
});

describe("S2 single hop", () => {
  it("every redirect row normalizes to a serve result", () => {
    const redirectPaths = [
      ...ROWS.filter((r) => r.expect.kind === "redirect").map((r) => ({
        path: r.path,
        search: "",
        location: (r.expect as { location: string }).location,
      })),
      ...TAB_ROWS.filter((r) => r.expect.kind === "redirect").map((r) => ({
        path: r.path,
        search: r.search,
        location: (r.expect as { location: string }).location,
      })),
      { path: "/the-daily-fix/261004/brain", search: "?x=1", location: "/the-daily-fix/261004?x=1&tab=brain" },
      {
        path: "/the-daily-fix/2026-10-04/brain",
        search: "",
        location: "/the-daily-fix/261004?tab=brain",
      },
    ];
    for (const row of redirectPaths) {
      const first = normalizeDailyFixPath(row.path, row.search);
      expect(first.kind, row.path).toBe("redirect");
      if (first.kind !== "redirect") continue;
      expect(first.location).toBe(row.location);
      const q = first.location.includes("?")
        ? first.location.slice(first.location.indexOf("?"))
        : "";
      const p = first.location.includes("?")
        ? first.location.slice(0, first.location.indexOf("?"))
        : first.location;
      expect(normalizeDailyFixPath(p, q).kind, first.location).toBe("serve");
    }
  });
});

describe("S3 import identity", () => {
  it("worker/shared and client re-export the same function", () => {
    expect(clientNormalize).toBe(normalizeDailyFixPath);
  });
});

describe("wrangler pin (W1 partial)", () => {
  it("pins wrangler exact >=4.20.0", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"),
    );
    const v = pkg.devDependencies.wrangler as string;
    expect(v).not.toMatch(/^[~^]/);
    const [maj, min] = v.split(".").map(Number);
    expect(maj).toBeGreaterThanOrEqual(4);
    if (maj === 4) expect(min).toBeGreaterThanOrEqual(20);
  });
});
