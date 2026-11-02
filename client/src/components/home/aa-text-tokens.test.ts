/**
 * T-E-35 muted token pin (rev1.0.5 P-E-3a).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLOR_ACCENT_TEXT, COLOR_MUTED_TEXT } from "./aa-text-tokens";

const HOME_DIR = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_SRC = join(process.cwd(), "client/src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("T-E-35 muted / gold AA tokens", () => {
  it("pins constants", () => {
    expect(COLOR_MUTED_TEXT).toBe("#686158");
    expect(COLOR_ACCENT_TEXT).toBe("#775f37");
  });

  it("home.css sets --color-muted to #686158", () => {
    const css = readFileSync(join(HOME_DIR, "home.css"), "utf8");
    expect(css).toMatch(/--color-muted:\s*#686158/);
    expect(css).toMatch(/--join-muted:\s*#686158/);
    expect(css).toMatch(/\.text-muted-2\s*\{\s*color:\s*var\(--color-muted\)/);
    expect(css).not.toMatch(/#6b645a|#6e675c/);
  });

  it("home/** and GlobalNav have no forbidden muted hex", () => {
    const files = [
      ...walk(HOME_DIR),
      join(process.cwd(), "client/src/components/GlobalNav.tsx"),
      join(process.cwd(), "client/src/components/global-nav.css"),
    ];
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/#6b645a|#6e675c/i.test(text)) hits.push(file);
    }
    expect(hits).toEqual([]);
  });

  it("Membership muted sites resolve via --join-muted under .home-root", () => {
    const membership = readFileSync(join(CLIENT_SRC, "components/Membership.tsx"), "utf8");
    expect(membership).toMatch(/--join-muted/);
  });
});

describe("T-E-45 muted-2 text → #686158 (LR-E15 / P-E-3b)", () => {
  it("Hero legal line uses text-muted, not text-muted-2", () => {
    const hero = readFileSync(join(HOME_DIR, "HomeHero.tsx"), "utf8");
    expect(hero).toMatch(/text-muted">\s*\n\s*By joining/);
    expect(hero).not.toMatch(/text-muted-2/);
  });

  it("#8a8378 only appears as --color-muted-2 decorative token in home.css", () => {
    const files = walk(HOME_DIR);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("#8a8378")) continue;
      if (file.endsWith("home.css") && /--color-muted-2:\s*#8a8378/.test(text)) continue;
      hits.push(file);
    }
    expect(hits).toEqual([]);
  });
});
