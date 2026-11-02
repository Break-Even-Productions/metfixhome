import { describe, expect, it } from "vitest";
import { mapResourceVideo } from "./video";

describe("mapResourceVideo (TC9)", () => {
  it("maps YouTube object and watch URL string", () => {
    const obj = mapResourceVideo({
      type: "YouTube",
      video_id: "dQw4w9WgXcQ",
    });
    expect(obj?.kind).toBe("youtube");
    expect(obj?.embedUrl).toContain("embed/dQw4w9WgXcQ");

    const str = mapResourceVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(str?.kind).toBe("youtube");
  });

  it("maps Vimeo object and URL string", () => {
    const obj = mapResourceVideo({ type: "Vimeo", video_id: "123456789" });
    expect(obj?.kind).toBe("vimeo");
    expect(obj?.embedUrl).toContain("123456789");

    const str = mapResourceVideo("https://vimeo.com/123456789");
    expect(str?.kind).toBe("vimeo");
  });

  it("maps self hosted brokenscience.org", () => {
    const obj = mapResourceVideo({
      type: "Self Hosted",
      url: "https://brokenscience.org/wp-content/uploads/video.mp4",
    });
    expect(obj?.kind).toBe("self_hosted");
    expect(obj?.url).toContain("brokenscience.org");
  });

  it("rejects unsafe schemes and hosts", () => {
    expect(mapResourceVideo("javascript:alert(1)")).toBeNull();
    expect(mapResourceVideo("data:text/html,hi")).toBeNull();
    expect(mapResourceVideo("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(mapResourceVideo("https://evil.example/video.mp4")).toBeNull();
    expect(mapResourceVideo("https://brokenscience.org/../etc/passwd")).toBeNull();
  });

  it("returns null when allowPlayable is false (SEC10)", () => {
    expect(
      mapResourceVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ", {
        allowPlayable: false,
      }),
    ).toBeNull();
  });
});
