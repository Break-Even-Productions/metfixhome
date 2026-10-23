/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import type { SearchTab } from "@shared/library";
import {
  activeTabKey,
  canonicalSearchResetKey,
  clearAllFilters,
  countLineText,
  parseSearchUrl,
  selectAllTab,
  selectPill,
  selectTopicTab,
  stateToFetchParams,
  type SearchUrlState,
} from "./searchState";

const TABS: SearchTab[] = [
  { topicId: 13, label: "Women's Health & Hormones" },
  { topicId: 99, label: "Professional Library" },
  { topicId: 11, label: "Metabolic Health" },
  { topicId: 12, label: "Coaches" },
];

const PILLS = ["videos", "articles", "webinars", "infographic"] as const;

function assertSingleFilters(params: ReturnType<typeof stateToFetchParams>) {
  expect((params.content_type_terms ?? []).length).toBeLessThanOrEqual(1);
  expect((params.topics ?? []).length).toBeLessThanOrEqual(1);
}

describe("TC-T2 searchState → params / URL", () => {
  it("All / All / no query → no filter params", () => {
    const state: SearchUrlState = { query: "", type: null, topic: null };
    expect(stateToFetchParams(state)).toEqual({});
    assertSingleFilters(stateToFetchParams(state));
  });

  it("4 pills × {All, tab 11} → exact param sets (8 cases)", () => {
    for (const slug of PILLS) {
      const allTab: SearchUrlState = { query: "", type: slug, topic: null };
      expect(stateToFetchParams(allTab)).toEqual({
        content_type_terms: [slug],
      });
      assertSingleFilters(stateToFetchParams(allTab));

      const withTopic: SearchUrlState = { query: "", type: slug, topic: 11 };
      expect(stateToFetchParams(withTopic)).toEqual({
        content_type_terms: [slug],
        topics: [11],
      });
      assertSingleFilters(stateToFetchParams(withTopic));
    }
  });

  it("SS18 independence: pill keeps tab; tab keeps pill", () => {
    let state: SearchUrlState = { query: "keto", type: null, topic: null };
    state = selectTopicTab(state, 11);
    expect(state.topic).toBe(11);
    expect(state.type).toBeNull();
    state = selectPill(state, "articles");
    expect(state).toEqual({ query: "keto", type: "articles", topic: 11 });
    expect(stateToFetchParams(state)).toEqual({
      query: "keto",
      content_type_terms: ["articles"],
      topics: [11],
    });

    state = selectPill(state, "infographic");
    expect(state.topic).toBe(11);
    state = selectTopicTab(state, 12);
    expect(state.type).toBe("infographic");
    expect(state.topic).toBe(12);

    state = selectPill(state, null);
    expect(state.topic).toBe(12);
    expect(state.type).toBeNull();

    state = selectAllTab(state);
    expect(state.type).toBeNull();
    expect(state.topic).toBeNull();
  });

  it("SS13 invalid type & topic fallback to All (absent from fetch)", () => {
    for (const search of [
      "type=Live%20Streams",
      "type=bogus",
      "type=whiteboards",
      "topic=0",
      "topic=-3",
      "topic=1.5",
      "topic=abc",
    ]) {
      const state = parseSearchUrl(search);
      expect(state.type).toBeNull();
      expect(state.topic).toBeNull();
      expect(stateToFetchParams(state)).toEqual({});
      expect(activeTabKey(state, TABS)).toBe("all");
    }
  });

  it("SS13 topic=555 kept; All tab not selected", () => {
    const state = parseSearchUrl("topic=555");
    expect(state.topic).toBe(555);
    expect(stateToFetchParams(state)).toEqual({ topics: [555] });
    expect(activeTabKey(state, TABS)).toBe("none");
  });

  it("SS13 Live Streams slug webinars; full URL parse", () => {
    const state = parseSearchUrl("query=fat&type=videos&topic=11");
    expect(state).toEqual({ query: "fat", type: "videos", topic: 11 });
    expect(stateToFetchParams(state)).toEqual({
      query: "fat",
      content_type_terms: ["videos"],
      topics: [11],
    });
    expect(activeTabKey(state, TABS)).toEqual({ topicId: 11 });

    const streams = parseSearchUrl("type=webinars");
    expect(streams.type).toBe("webinars");
    expect(stateToFetchParams(streams)).toEqual({
      content_type_terms: ["webinars"],
    });
  });

  it("SS9 countLineText cases", () => {
    expect(
      countLineText({ n: 3, query: "", tabLabel: "Metabolic Health" }),
    ).toBe("3 resources in Metabolic Health");
    expect(
      countLineText({
        n: 3,
        query: "",
        tabLabel: "Women's Health & Hormones",
      }),
    ).toBe("3 resources in Women's Health & Hormones");
    expect(countLineText({ n: 1, query: "", tabLabel: null })).toBe(
      "1 resource",
    );
    expect(countLineText({ n: 2, query: "fat", tabLabel: null })).toBe(
      '2 resources for "fat"',
    );
    expect(countLineText({ n: 0, query: "", tabLabel: null })).toBe(
      "0 resources",
    );
    expect(countLineText({ n: 3, query: "", tabLabel: null })).toBe(
      "3 resources",
    );
    expect(countLineText({ n: 40, query: "", tabLabel: null })).toBe(
      "40 resources",
    );
  });

  it("SS17(e) resetKey equal for swapped query/topic order", () => {
    expect(
      canonicalSearchResetKey({ query: "a", type: null, topic: 101 }),
    ).toBe(canonicalSearchResetKey({ query: "a", type: null, topic: 101 }));
    const a = canonicalSearchResetKey(
      parseSearchUrl("topic=101&query=a"),
    );
    const b = canonicalSearchResetKey(
      parseSearchUrl("query=a&topic=101"),
    );
    expect(a).toBe(b);
  });

  it("clearAllFilters resets query, type, and topic", () => {
    expect(clearAllFilters()).toEqual({
      query: "",
      type: null,
      topic: null,
    });
  });
});
