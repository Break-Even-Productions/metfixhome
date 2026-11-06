import { describe, expect, it } from "vitest";
import {
  listItemWasOmitted,
  parseAddListItemBody,
  parseCreateListBody,
  parseInviteSubscriberBody,
  shapeListItem,
  shapeListsPayload,
} from "./userLists";

describe("user lists allowlist", () => {
  it("shapes a list index and drops unexpected fields", () => {
    const page = shapeListsPayload({
      lists: [
        {
          id: 4,
          title: "Race week",
          description: "Prep <b>notes</b>",
          visibility: "public",
          item_count: 2,
          list_relationship: "owner",
          share_token: "ab".repeat(16),
          cover_image_url: "https://brokenscience.org/cover.jpg",
          body: "<p>secret</p>",
          owner_email: "a@b.test",
        },
      ],
      meta: { count: 1, total: 1, limit: 20, offset: 0 },
    });
    expect(page?.lists).toHaveLength(1);
    expect(page?.lists[0]).toMatchObject({
      id: 4,
      title: "Race week",
      description: "Prep notes",
      visibility: "public",
      list_relationship: "owner",
    });
    expect(JSON.stringify(page)).not.toContain("secret");
    expect(JSON.stringify(page)).not.toContain("owner_email");
  });

  it("strips post HTML from list items", () => {
    const item = shapeListItem({
      id: 9,
      list_id: 4,
      sort_order: 1,
      note: "bring this",
      content: {
        source_type: "post",
        source_id: 88,
        title: "Briefing",
        excerpt: "Short",
        body: "<p>full article</p>",
        article_url: "https://brokenscience.org/briefing",
        photo_url: "javascript:alert(1)",
      },
    });
    expect(item?.content.title).toBe("Briefing");
    expect(item?.content.article_url).toBe("https://brokenscience.org/briefing");
    expect(item?.content.photo_url).toBeNull();
    expect(item).not.toHaveProperty("content.body");
    expect(JSON.stringify(item)).not.toContain("full article");
  });

  it("rejects an empty title and an unknown source type", () => {
    expect(parseCreateListBody({ title: "  " }).ok).toBe(false);
    expect(parseCreateListBody({ title: "Warmup", visibility: "unlisted" }).ok).toBe(true);
    expect(parseAddListItemBody({ source_type: "evil", source_id: 1 }).ok).toBe(false);
    expect(parseAddListItemBody({ source_type: "post", source_id: 12 }).ok).toBe(true);
    expect(parseAddListItemBody({ source_type: "custom_workout", source_id: 3 }).ok).toBe(true);
    expect(parseInviteSubscriberBody({ user_id: 15 }).value).toEqual({ user_id: 15 });
    expect(parseInviteSubscriberBody({ user_id: 0 }).ok).toBe(false);
    expect(listItemWasOmitted({ list_item: null })).toBe(true);
    expect(listItemWasOmitted({ list_item: { id: 1 } })).toBe(false);
  });
});
