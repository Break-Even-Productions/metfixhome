/**
 * T-E-19 / T-E-28 / T-E-NAV-10 repo scans for home port.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HOME_DIR = fileURLToPath(new URL(".", import.meta.url));
const GLOBAL_NAV = fileURLToPath(new URL("../GlobalNav.tsx", import.meta.url));
const WHOP_FILE = fileURLToPath(new URL("../../../../shared/account/whop.ts", import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("T-E-19 home repo-scan", () => {
  const files = walk(HOME_DIR);

  it("home/** has no fetch( to absolute URLs", () => {
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const re = /fetch\(\s*[`'"]https?:\/\//g;
      if (re.test(text)) hits.push(file);
    }
    expect(hits).toEqual([]);
  });

  it("home/** has no import.meta.env", () => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes("import.meta.env"));
    expect(hits).toEqual([]);
  });

  it("home/** has no `/ 100` money math", () => {
    const hits = files.filter((f) => /\/\s*100\b/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("home/** does not import Map.tsx", () => {
    const hits = files.filter((f) => /from\s+['\"]@\/components\/Map['\"]|from\s+['\"].*\/Map['\"]/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("home/** has no Substack / Manus / foreign Whop", () => {
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/substack\.com|\/api\/substack|manus|curie\.whop|biz_(?!u15G8d34g9c0B0)/i.test(text)) {
        hits.push(file);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("T-E-28 / T-E-40 kept + home/** + GlobalNav tokens (LR-E5/E6)", () => {
  it("HomeTargetKept has no raw hex/rgb colors or inline fontFamily", () => {
    const src = readFileSync(join(HOME_DIR, "HomeTargetKept.tsx"), "utf8");
    expect(src).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
    expect(src).not.toMatch(/rgba?\(/);
    expect(src).not.toMatch(/fontFamily\s*:/);
    expect(src).not.toMatch(/#0A0A0A|#080808/);
  });

  it("home.css defines beta cream/ink/accent tokens under .home-root", () => {
    const css = readFileSync(join(HOME_DIR, "home.css"), "utf8");
    expect(css).toMatch(/\.home-root\s*\{/);
    expect(css).toMatch(/--color-cream:\s*#f3eee4/);
    expect(css).toMatch(/--color-ink:\s*#171512/);
    expect(css).toMatch(/--color-accent:\s*#c4a46c/);
    expect(css).toMatch(/--color-muted:\s*#686158/);
    expect(css).toMatch(/--font-serif/);
    expect(css).toMatch(/--font-sans/);
  });

  it("seven kept section ids exist (incl membership-section)", () => {
    const kept = readFileSync(join(HOME_DIR, "HomeTargetKept.tsx"), "utf8");
    const home = readFileSync(join(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    for (const id of ["impact", "playbook", "affiliation", "about", "gap", "network"]) {
      expect(kept).toMatch(new RegExp(`id="${id}"`));
    }
    expect(home).toMatch(/id="membership-section"/);
  });
});

describe("T-E-NAV-10 returnPath usage", () => {
  it("GlobalNav imports sanitizeReturnPath from shared/account/returnPath", () => {
    const src = readFileSync(GLOBAL_NAV, "utf8");
    expect(src).toMatch(/from\s+["']@shared\/account\/returnPath["']/);
    expect(src).toMatch(/sanitizeReturnPath/);
    expect(src).not.toMatch(/sanitize-return-path/);
  });

  it("home/** does not import shared/sanitize-return-path", () => {
    const hits = walk(HOME_DIR).filter((f) =>
      /sanitize-return-path/.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
  });

  it("sole biz_ literal remains in shared/account/whop.ts", () => {
    const whop = readFileSync(WHOP_FILE, "utf8");
    expect(whop).toMatch(/biz_u15G8d34g9c0B0/);
    const homeBiz = walk(HOME_DIR).flatMap((f) => {
      const m = readFileSync(f, "utf8").match(/biz_[A-Za-z0-9]+/g);
      return m ?? [];
    });
    expect(homeBiz).toEqual([]);
  });
});

describe("B2 / S6 / T-E-60 Search link + Map + Forge URL", () => {
  const clientSrc = fileURLToPath(new URL("..", import.meta.url));

  it("GlobalNav has no SearchOverlay / SEARCH_ITEMS / searchOpen (LR-4)", () => {
    const src = readFileSync(GLOBAL_NAV, "utf8");
    expect(src).not.toMatch(/SearchOverlay/);
    expect(src).not.toMatch(/SEARCH_ITEMS/);
    expect(src).not.toMatch(/searchOpen/);
    expect(src).toMatch(/SEARCH_HREF/);
  });

  it("nothing under client/src imports components/Map", () => {
    const files = walk(clientSrc);
    const hits = files.filter((f) =>
      /from\s+['\"]@\/components\/Map['\"]|from\s+['\"].*\/Map['\"]/.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
  });

  it("VITE_FRONTEND_FORGE_API_URL is absent from vite-env.d.ts", () => {
    const env = readFileSync(
      fileURLToPath(new URL("../../vite-env.d.ts", import.meta.url)),
      "utf8",
    );
    expect(env).not.toMatch(/VITE_FRONTEND_FORGE_API_URL/);
  });

  it("exactly one function sanitizeReturnPath in shared/", () => {
    const sharedRoot = fileURLToPath(new URL("../../../../shared", import.meta.url));
    const files = walk(sharedRoot);
    const defs = files.flatMap((f) => {
      const text = readFileSync(f, "utf8");
      const matches = text.match(/function sanitizeReturnPath/g);
      return matches ? matches.map(() => f) : [];
    });
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatch(/returnPath\.ts$/);
  });
});

describe("S4 hero image budget", () => {
  it("hero images declare width/height in HomeHero", () => {
    const hero = readFileSync(join(HOME_DIR, "HomeHero.tsx"), "utf8");
    expect(hero).toMatch(/width=\{1600\}/);
    expect(hero).toMatch(/height=\{1067\}/);
    expect(hero).toMatch(/fetchPriority=["']high["']/);
  });
});

describe("T-E-48 / TIMER1 timers", () => {
  it("HomeTestimonials has 0 setInterval / setTimeout", () => {
    const src = readFileSync(join(HOME_DIR, "HomeTestimonials.tsx"), "utf8");
    expect(src).not.toMatch(/\bsetInterval\b/);
    expect(src).not.toMatch(/\bsetTimeout\b/);
    expect(src).toMatch(/animationPlayState|animation-play-state/);
  });

  it("HomeFoundations autoplay gated on IntersectionObserver", () => {
    const src = readFileSync(join(HOME_DIR, "HomeFoundations.tsx"), "utf8");
    expect(src).toMatch(/IntersectionObserver/);
    expect(src).toMatch(/4200/);
  });
});

describe("T-E-38 / CACHE1 allSettled", () => {
  it("home content loader uses Promise.allSettled (0 Promise.all()", () => {
    const src = readFileSync(
      fileURLToPath(new URL("../../hooks/useSanityContent.ts", import.meta.url)),
      "utf8",
    );
    expect(src).toMatch(/Promise\.allSettled\s*\(/);
    expect(src).not.toMatch(/Promise\.all\s*\(/);
  });
});

describe("T-E-21 / CSS1 home.css scope", () => {
  it("every non-at-rule selector in home.css is under .home-root", () => {
    const css = readFileSync(join(HOME_DIR, "home.css"), "utf8");
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    /** Split a selector list on top-level commas (ignore commas inside :is/:where()). */
    function topLevelParts(sel: string): string[] {
      const parts: string[] = [];
      let depth = 0;
      let buf = "";
      for (const ch of sel) {
        if (ch === "(") depth++;
        if (ch === ")") depth = Math.max(0, depth - 1);
        if (ch === "," && depth === 0) {
          parts.push(buf.trim());
          buf = "";
          continue;
        }
        buf += ch;
      }
      if (buf.trim()) parts.push(buf.trim());
      return parts;
    }
    const selectors: string[] = [];
    const re = /(^|})\s*([^{}]+)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped))) {
      const sel = m[2].trim();
      if (!sel || sel.startsWith("@")) continue;
      if (/^(from|to|\d+%)$/i.test(sel)) continue;
      selectors.push(sel);
    }
    expect(selectors.length).toBeGreaterThan(10);
    const bad = selectors.filter((sel) =>
      topLevelParts(sel).some((part) => !part.startsWith(".home-root")),
    );
    expect(bad).toEqual([]);
  });
});

describe("T-E-17 / SEC2 no wp-json in client/src", () => {
  it("client/src has 0 wp-json literals (case-insensitive)", () => {
    const clientSrc = fileURLToPath(new URL("../..", import.meta.url));
    const files = walk(clientSrc);
    const hits = files.filter((f) => /wp-json/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});

describe("T-E-54 / NAVDATA1 METFIX_MAP_URL", () => {
  it("METFIX_MAP_URL defined exactly once in const.ts", () => {
    const constSrc = readFileSync(
      fileURLToPath(new URL("../../const.ts", import.meta.url)),
      "utf8",
    );
    expect(constSrc.match(/export const METFIX_MAP_URL/g)).toHaveLength(1);
    expect(constSrc).toMatch(
      /METFIX_MAP_URL\s*=\s*["']https:\/\/brokenscience\.org\/metfix\/metfix-map\/["']/,
    );
    const clientSrc = fileURLToPath(new URL("../..", import.meta.url));
    const defs = walk(clientSrc).flatMap((f) => {
      const text = readFileSync(f, "utf8");
      return (text.match(/export\s+const\s+METFIX_MAP_URL\s*=/g) ?? []).map(() => f);
    });
    expect(defs).toHaveLength(1);
  });
});
