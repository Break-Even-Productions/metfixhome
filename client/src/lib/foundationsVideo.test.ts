import { describe, expect, it } from "vitest";
import { parseFoundationsVideoUrl, parseFoundationsVideos } from "./foundationsVideo";

describe("parseFoundationsVideoUrl", () => {
  it("parses YouTube watch, shorts, embed, and youtu.be", () => {
    const id = "jHXO-qIk28A";
    for (const raw of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://youtu.be/${id}`,
    ]) {
      const v = parseFoundationsVideoUrl(raw);
      expect(v?.kind).toBe("youtube");
      expect(v?.embedUrl).toContain(`/embed/${id}`);
      expect(v?.embedUrl).toContain("playsinline=1");
      expect(v?.posterUrl).toBe(`https://img.youtube.com/vi/${id}/hqdefault.jpg`);
    }
  });

  it("preserves Vimeo privacy hash from player and share URLs", () => {
    const fromPlayer = parseFoundationsVideoUrl(
      "https://player.vimeo.com/video/1193427610?h=f9a70db6c8&title=0&byline=0&portrait=0",
    );
    expect(fromPlayer?.kind).toBe("vimeo");
    expect(fromPlayer?.embedUrl).toContain("/video/1193427610");
    expect(fromPlayer?.embedUrl).toContain("h=f9a70db6c8");
    expect(fromPlayer?.embedUrl).toContain("title=0");

    const fromShare = parseFoundationsVideoUrl("https://vimeo.com/1193427610/f9a70db6c8");
    expect(fromShare?.kind).toBe("vimeo");
    expect(fromShare?.embedUrl).toContain("h=f9a70db6c8");
  });

  it("rejects non-https and unknown hosts", () => {
    expect(parseFoundationsVideoUrl("http://www.youtube.com/watch?v=jHXO-qIk28A")).toBeNull();
    expect(parseFoundationsVideoUrl("https://example.com/video/1")).toBeNull();
  });
});

describe("parseFoundationsVideos", () => {
  it("filters invalid entries and keeps order", () => {
    const videos = parseFoundationsVideos([
      "https://vimeo.com/1193427610/f9a70db6c8",
      "not-a-url",
      "https://www.youtube.com/watch?v=jHXO-qIk28A",
    ]);
    expect(videos).toHaveLength(2);
    expect(videos[0]?.kind).toBe("vimeo");
    expect(videos[1]?.kind).toBe("youtube");
  });
});
