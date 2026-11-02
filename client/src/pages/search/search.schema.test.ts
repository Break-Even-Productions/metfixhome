import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("siteSettings searchTopics schema (SN-T1)", () => {
  const src = fs.readFileSync(
    path.resolve(import.meta.dirname, "../../../../sanity/schemaTypes/siteSettings.ts"),
    "utf8",
  );

  it("has searchTopics with topic_id + optional label only", () => {
    expect(src).toMatch(/name:\s*"searchTopics"/);
    expect(src).toMatch(/name:\s*"topic_id"/);
    expect(src).toMatch(/name:\s*"label"/);
    expect(src).toMatch(/group:\s*"search"/);
    expect(src).not.toMatch(/typeSlug|bsiTermId|name:\s*"kind"/);
    expect(src).not.toMatch(/Rule\.max\(/);
  });

  it("topic_id validation requires positive integer", () => {
    expect(src).toMatch(/topic_id[\s\S]*?Rule\.required\(\)[\s\S]*?\.integer\(\)[\s\S]*?\.positive\(\)/);
  });

  it("no new document type files for search", () => {
    const dir = path.resolve(import.meta.dirname, "../../../../sanity/schemaTypes");
    const files = fs.readdirSync(dir);
    expect(files.some((f) => /search/i.test(f) && f !== "siteSettings.ts")).toBe(false);
  });
});
