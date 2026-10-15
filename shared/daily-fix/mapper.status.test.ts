import { describe, expect, it } from "vitest";
import { mapDailyFixDay } from "./mapper";
import { mapDailyFixDay as clientMap } from "../../client/src/pages/the-daily-fix/data";
import { resolveDailyFixStatus, type UpstreamOutcome } from "./status";

const restDayBody = {
  date: "2026-10-05",
  belly: {
    title: "Rest meal",
    macros: { fat: null, carb: null, protein: null },
    has_structured_ingredients: false,
    has_structured_steps: false,
    recipe_ingredients: [],
    recipe_steps: [],
  },
  body: {
    title: "Rest",
    body: null,
    excerpt: "<p>Rest day</p>",
  },
  brain: {
    title: "Rest read",
    body: "<p>Take it easy</p>",
    excerpt: null,
  },
};

const fullDay = {
  date: "2026-10-04",
  belly: {
    title: "Steak",
    body: "<p>Eggs</p>",
    steps: "<p>Cook</p>",
    macros: { fat: 1, carb: 2, protein: 3 },
    photo_url: "https://cdn.example.com/b.jpg",
    has_structured_ingredients: false,
    has_structured_steps: false,
    recipe_ingredients: [],
    recipe_steps: [],
  },
  body: {
    title: "Push",
    body: "<p>Work</p>",
    photo_url: "https://cdn.example.com/body.jpg",
  },
  brain: {
    title: "Read",
    body: "<p>Think</p>",
    photo_url: "https://cdn.example.com/brain.jpg",
  },
  comment_counts: { belly: 1, body: 2, brain: 3 },
};

describe("S4 mapper hasContent", () => {
  it("rest-day body hasContent false and still renders Rest day", () => {
    const day = mapDailyFixDay(restDayBody);
    expect(day).not.toBeNull();
    expect(day!.body.hasContent).toBe(false);
    expect(day!.body.html).toContain("Rest day");
    expect(day!.belly.hasContent).toBe(false);
    expect(day!.brain.hasContent).toBe(true);
  });

  it("belly hasContent from recipe/body text; brain from article body", () => {
    const day = mapDailyFixDay(fullDay);
    expect(day!.belly.hasContent).toBe(true);
    expect(day!.body.hasContent).toBe(true);
    expect(day!.brain.hasContent).toBe(true);
  });

  it("output has no comment_counts", () => {
    const day = mapDailyFixDay(fullDay) as unknown as Record<string, unknown>;
    expect(day).not.toHaveProperty("comment_counts");
  });
});

describe("S5 mapper identity", () => {
  it("worker and client use the same mapper export", () => {
    expect(clientMap).toBe(mapDailyFixDay);
    expect(mapDailyFixDay(fullDay)).toEqual(clientMap(fullDay));
  });
});

describe("S6 status module table", () => {
  const mapped = mapDailyFixDay(fullDay)!;

  const cases: Array<{
    name: string;
    route: "bare" | "dated";
    outcome: UpstreamOutcome;
    status: number;
    head: string;
    cacheable: boolean;
  }> = [
    {
      name: "dated 200",
      route: "dated",
      outcome: { kind: "ok", status: 200, json: fullDay, mapped },
      status: 200,
      head: "full",
      cacheable: true,
    },
    {
      name: "dated 404",
      route: "dated",
      outcome: { kind: "not_found", status: 404 },
      status: 404,
      head: "generic_noindex",
      cacheable: false,
    },
    {
      name: "dated mismatch",
      route: "dated",
      outcome: { kind: "mismatch", status: 200, json: fullDay, mapped },
      status: 404,
      head: "generic_noindex",
      cacheable: false,
    },
    {
      name: "dated unmappable",
      route: "dated",
      outcome: { kind: "unmappable", status: 200, json: {} },
      status: 404,
      head: "generic_noindex",
      cacheable: false,
    },
    {
      name: "bare 200",
      route: "bare",
      outcome: { kind: "ok", status: 200, json: fullDay, mapped },
      status: 200,
      head: "full",
      cacheable: true,
    },
    {
      name: "bare unusable",
      route: "bare",
      outcome: { kind: "not_found", status: 404 },
      status: 200,
      head: "generic",
      cacheable: false,
    },
    {
      name: "5xx",
      route: "dated",
      outcome: { kind: "upstream_error", status: 500 },
      status: 503,
      head: "generic",
      cacheable: false,
    },
    {
      name: "timeout",
      route: "dated",
      outcome: { kind: "timeout" },
      status: 503,
      head: "generic",
      cacheable: false,
    },
    {
      name: "throw",
      route: "dated",
      outcome: { kind: "throw" },
      status: 503,
      head: "generic",
      cacheable: false,
    },
    {
      name: "nokey",
      route: "dated",
      outcome: { kind: "nokey" },
      status: 503,
      head: "generic",
      cacheable: false,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const r = resolveDailyFixStatus(c.route, c.outcome);
      expect(r.httpStatus).toBe(c.status);
      expect(r.headKind).toBe(c.head);
      expect(r.cacheable).toBe(c.cacheable);
    });
  }
});
