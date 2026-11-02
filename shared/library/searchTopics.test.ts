import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveSearchTabs } from "./searchTopics";
import type { LibraryFilterTerm } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));

function api(
  rows: Array<{ id: number; name?: string; slug?: string }>,
): LibraryFilterTerm[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? `Topic ${r.id}`,
    slug: r.slug ?? `topic-${r.id}`,
    description: null,
    image: null,
  }));
}

describe("SN-T3 resolveSearchTabs", () => {
  it("(a) Sanity first, dedupe by id, Sanity label wins", () => {
    const tabs = resolveSearchTabs(
      [
        { topic_id: 13, label: "Women's Health & Hormones" },
        { topic_id: 99, label: "Professional Library" },
      ],
      api([
        { id: 11, name: "Metabolic Health" },
        { id: 12, name: "Coaches" },
        { id: 13, name: "Women's Health" },
      ]),
    );
    expect(tabs).toEqual([
      { topicId: 13, label: "Women's Health & Hormones" },
      { topicId: 99, label: "Professional Library" },
      { topicId: 11, label: "Metabolic Health" },
      { topicId: 12, label: "Coaches" },
    ]);
  });

  it("(b) Sanity missing / empty / rejected → API list in API order", () => {
    const topics = api([
      { id: 11, name: "Metabolic Health" },
      { id: 12, name: "Coaches" },
      { id: 13, name: "Women's Health" },
    ]);
    expect(resolveSearchTabs(null, topics)).toEqual([
      { topicId: 11, label: "Metabolic Health" },
      { topicId: 12, label: "Coaches" },
      { topicId: 13, label: "Women's Health" },
    ]);
    expect(resolveSearchTabs(undefined, topics)).toEqual([
      { topicId: 11, label: "Metabolic Health" },
      { topicId: 12, label: "Coaches" },
      { topicId: 13, label: "Women's Health" },
    ]);
    expect(resolveSearchTabs([], topics)).toEqual([
      { topicId: 11, label: "Metabolic Health" },
      { topicId: 12, label: "Coaches" },
      { topicId: 13, label: "Women's Health" },
    ]);
  });

  it("(c) API empty → Sanity only; unlabelled Sanity → Topic {id}", () => {
    expect(
      resolveSearchTabs(
        [
          { topic_id: 13, label: "Women's Health & Hormones" },
          { topic_id: 99 },
        ],
        [],
      ),
    ).toEqual([
      { topicId: 13, label: "Women's Health & Hormones" },
      { topicId: 99, label: "Topic 99" },
    ]);
    expect(
      resolveSearchTabs(
        [{ topic_id: 99, label: "Professional Library" }],
        null,
      ),
    ).toEqual([{ topicId: 99, label: "Professional Library" }]);
  });

  it("(d) both empty → []", () => {
    expect(resolveSearchTabs([], [])).toEqual([]);
    expect(resolveSearchTabs(null, null)).toEqual([]);
    expect(resolveSearchTabs(undefined, undefined)).toEqual([]);
  });

  it("(e) invalid Sanity rows skipped; valid neighbours kept", () => {
    const tabs = resolveSearchTabs(
      [
        { label: "No id" },
        { topic_id: 0, label: "Zero" },
        { topic_id: -2, label: "Neg" },
        { topic_id: 1.5 as unknown as number, label: "Float" },
        { topic_id: "13" as unknown as number, label: "String id" },
        { topic_id: 11, label: "Keep A" },
        { topic_id: 12, label: "Keep B" },
      ],
      [],
    );
    expect(tabs).toEqual([
      { topicId: 11, label: "Keep A" },
      { topicId: 12, label: "Keep B" },
    ]);
  });

  it("(f) duplicate Sanity ids → first label wins", () => {
    expect(
      resolveSearchTabs(
        [
          { topic_id: 13, label: "A" },
          { topic_id: 13, label: "B" },
        ],
        [],
      ),
    ).toEqual([{ topicId: 13, label: "A" }]);
  });

  it("(g) API topic without Sanity label uses API name", () => {
    expect(
      resolveSearchTabs([], api([{ id: 11, name: "Metabolic Health" }])),
    ).toEqual([{ topicId: 11, label: "Metabolic Health" }]);
  });

  it("resolver module has no hardcoded example labels", () => {
    const src = readFileSync(join(HERE, "searchTopics.ts"), "utf8");
    for (const label of [
      "Metabolic Health",
      "Special Populations",
      "Women's Health",
      "Professional Library",
      "Whiteboards",
      "Coaches",
      "BSI Educators",
      "Women's Health & Hormones",
    ]) {
      expect(src.includes(label)).toBe(false);
    }
  });
});
