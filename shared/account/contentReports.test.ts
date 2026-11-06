import { describe, expect, it } from "vitest";
import { parseContentReportBody, shapeContentReport } from "./contentReports";
import { parseCatalogQuery, shapeCatalog } from "./listCatalog";

describe("content reports", () => {
  it("forces platform web and drops an unknown type", () => {
    const parsed = parseContentReportBody({
      content_type: "user_list",
      content_id: 4,
      reason_code: "spam",
      note: "  copied <b>workout</b>  ",
      platform: "ios",
      context: { secret: "nope" },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual({
      content_type: "user_list",
      content_id: 4,
      reason_code: "spam",
      note: "copied workout",
      platform: "web",
    });
    expect(parseContentReportBody({ content_type: "nope", content_id: 1, reason_code: "spam" }).ok).toBe(
      false,
    );
  });

  it("shapes a receipt and ignores the upstream message", () => {
    const receipt = shapeContentReport({
      id: 9,
      report_id: 9,
      content_type: "user_list",
      content_id: 4,
      status: "pending",
      message: "internal",
    });
    expect(receipt).toEqual({
      id: 9,
      content_type: "user_list",
      content_id: 4,
      status: "pending",
    });
  });
});

describe("list catalogs", () => {
  it("keeps titles and drops recipe bodies", () => {
    const page = shapeCatalog(
      {
        recipes: [
          { id: 3, title: "My bowl", instructions: "secret steps", body: "<p>html</p>" },
        ],
      },
      "recipes",
    );
    expect(page).toEqual({ items: [{ id: 3, title: "My bowl" }] });
    expect(JSON.stringify(page)).not.toContain("secret");
    expect(parseCatalogQuery(new URLSearchParams("limit=20&offset=0")).value).toBe(
      "limit=20&offset=0",
    );
    expect(parseCatalogQuery(new URLSearchParams("limit=0")).ok).toBe(false);
  });
});
