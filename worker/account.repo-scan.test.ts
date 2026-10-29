/**
 * PR B account repo-scan gates (CQ §5.3 / QA r1.1): zero Curie Whop, cancel_med,
 * manus, dangerouslySetInnerHTML in account/member pages, Rule-4 test hooks,
 * BEP biz pin, dist/ scan, COACH1 100000, CERT2 shared ltv import.
 */
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { BEP_WHOP_COMPANY_ID } from "../shared/account/whop";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Frozen 1.2.12 money-scan matchers (shared by CL-MONEY-SCAN-1 + CL-SCAN-REVIEW-1). */
function moneyScanMatchers() {
  const CENTS_DIV_A =
    /(?<!\w*bps[ \t]*(?<!\/)\*(?!\/)[ \t]*\(?[ \t]*\w*)_cents\b(?:[ \t()+\-]|\w*_cents\b)*\/[ \t]*100(?![\w.])/;
  const CENTS_DIV_B =
    /\((?![^()\n]*(?:(?<!\/)\*(?!\/)[ \t]*\w*bps\b|\b\w*bps[ \t]*(?<!\/)\*(?!\/)))[^()\n]*\b\w*_cents\b[^()\n]*\)[ \t]*\/[ \t]*100(?![\w.])/;
  const hitsMoney = (s: string) => CENTS_DIV_A.test(s) || CENTS_DIV_B.test(s);
  const ADVISORY_RE =
    /(?:\b\w*_cents\b[ \t]*\*[ \t]*(?:\d+|\w*bps\b)|\([^()\n]*\b\w*_cents\b[^()\n]*\*[ \t]*\w*bps\b[^()\n]*\)|\([^()\n]*\b\w*bps\b[^()\n]*\*[ \t]*[^()\n]*\b\w*_cents\b[^()\n]*\)|\b\w*bps\b[ \t]*\*[ \t]*\w*_cents\b)[ \t]*\/[ \t]*100(?![\w.])/;
  const hitsAdvisory = (s: string) => ADVISORY_RE.test(s) && !hitsMoney(s);
  return { hitsMoney, hitsAdvisory };
}

/** errata d3 DR-3: remove only the identifier; keep scanning call args. */
function scrubFormatUsdName(line: string): string {
  return line.replace(/\bformatUsdFromCents\b/g, "");
}

/**
 * Shared money-scan loop (CL-SCAN-REVIEW-1 / S-R4-3): real files → gating / LONGLINE / advisory.
 * When `emit`, writes MONEY-SCAN-* warns and one-entry-per-line `$GITHUB_STEP_SUMMARY`.
 */
function runMoneyScanOnFiles(
  files: string[],
  opts?: { emit?: boolean; root?: string },
): { gatingHits: string[]; longLineReview: string[]; advisoryHits: string[] } {
  const { hitsMoney, hitsAdvisory } = moneyScanMatchers();
  const root = opts?.root ?? REPO_ROOT;
  const longLineReview: string[] = [];
  const advisoryHits: string[] = [];
  const gatingHits: string[] = [];
  for (const file of files) {
    const rel = relative(root, file);
    if (rel.endsWith("shared/account/ltv.ts")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const scrubbed = scrubFormatUsdName(line);
      const loc = `${rel}:${i + 1}: ${line.trim().slice(0, 120)}`;
      if (hitsMoney(scrubbed)) {
        // errata d3 DR-2: long line with a real hit still fails (+ LONGLINE).
        if (line.length > 400) longLineReview.push(loc);
        gatingHits.push(loc);
        continue;
      }
      if (hitsAdvisory(scrubbed)) advisoryHits.push(loc);
    }
  }
  if (opts?.emit) {
    for (const loc of longLineReview) console.warn(`MONEY-SCAN-LONGLINE: ${loc}`);
    for (const loc of advisoryHits) console.warn(`MONEY-SCAN-ADVISORY: ${loc}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const sections: string[] = [];
      if (longLineReview.length > 0) {
        sections.push(
          "### Money scan — long lines (fail + LONGLINE)",
          "",
          ...longLineReview.map((l) => `- \`${l.replace(/`/g, "'")}\``),
          "",
        );
      }
      if (advisoryHits.length > 0) {
        sections.push(
          "### Money scan — advisory (N31, never fails)",
          "",
          ...advisoryHits.map((l) => `- \`${l.replace(/`/g, "'")}\``),
          "",
        );
      }
      if (sections.length > 0) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, sections.join("\n"));
      }
    }
  }
  return { gatingHits, longLineReview, advisoryHits };
}

function walkFiles(dir: string, pred: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      out.push(...walkFiles(full, pred));
    } else if (ent.isFile() && pred(ent.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanLines(
  files: string[],
  re: RegExp,
  opts?: { allow?: (file: string, line: string) => boolean; maxLineLen?: number },
): string[] {
  const failures: string[] = [];
  const maxLen = opts?.maxLineLen;
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (maxLen != null && line.length > maxLen) continue;
      if (!re.test(line)) continue;
      if (opts?.allow?.(file, line)) continue;
      failures.push(`${relative(REPO_ROOT, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  }
  return failures;
}

const SRC_PRED = (n: string) =>
  n.endsWith(".ts") ||
  n.endsWith(".tsx") ||
  n.endsWith(".js") ||
  n.endsWith(".jsx") ||
  n.endsWith(".jsonc") ||
  n.endsWith(".json");

function sourceFiles(): string[] {
  const dirs = ["client/src", "worker", "shared"].map((d) => join(REPO_ROOT, d));
  return [
    ...dirs.flatMap((d) => walkFiles(d, SRC_PRED)),
    join(REPO_ROOT, "wrangler.jsonc"),
  ].filter((f) => existsSync(f));
}

describe("account.repo-scan", () => {
  it("DP-WHOP-1 / T4: zero Curie Whop identifiers outside allowlisted reject logic", () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(0);

    const failures = scanLines(files, /curie/i, {
      allow: (file, line) => {
        const rel = relative(REPO_ROOT, file);
        if (rel === "shared/account/url-allowlist.ts" && /FORBIDDEN_WHOP|curie/.test(line)) {
          return true;
        }
        if (rel === "shared/account/url-allowlist.test.ts") return true;
        if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) {
          return /reject|forbid|zero|never|curie|plant/i.test(line);
        }
        return false;
      },
    });
    expect(failures, failures.join("\n")).toEqual([]);

    // CR-WHOP-1: sole biz_ literal is BEP in shared/account/whop.ts
    const bizFailures = scanLines(files, /biz_[A-Za-z0-9]+/, {
      allow: (file, line) => {
        const rel = relative(REPO_ROOT, file);
        if (rel === "shared/account/whop.ts" && line.includes("biz_u15G8d34g9c0B0")) return true;
        if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) return true;
        return false;
      },
    });
    expect(bizFailures, bizFailures.join("\n")).toEqual([]);
  });

  it("DP-WHOP-1: only BEP biz_ literal lives in shared/account/whop.ts; planted foreign fails", () => {
    const files = sourceFiles().filter((f) => {
      const rel = relative(REPO_ROOT, f);
      return !/\.test\.(ts|tsx)$/.test(rel);
    });
    const bizRe = /biz_[A-Za-z0-9]+/g;
    const foreign: string[] = [];
    const bepFiles: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = relative(REPO_ROOT, file);
      for (const m of text.matchAll(bizRe)) {
        if (m[0] !== BEP_WHOP_COMPANY_ID) {
          foreign.push(`${rel}: ${m[0]}`);
        } else if (rel !== "shared/account/whop.ts") {
          bepFiles.push(rel);
        }
      }
    }
    expect(foreign, foreign.join("\n")).toEqual([]);
    expect(bepFiles, `BEP literal must only appear in whop.ts; also in:\n${bepFiles.join("\n")}`).toEqual(
      [],
    );

    // Planted foreign biz_ must fail the scanner.
    const plantDir = mkdtempSync(join(tmpdir(), "whop1-plant-"));
    try {
      const plant = join(plantDir, "plant.js");
      writeFileSync(plant, `const x = "biz_FOREIGN123";\n`);
      const plantHits: string[] = [];
      for (const m of readFileSync(plant, "utf8").matchAll(bizRe)) {
        if (m[0] !== BEP_WHOP_COMPANY_ID) plantHits.push(m[0]);
      }
      expect(plantHits).toContain("biz_FOREIGN123");
    } finally {
      rmSync(plantDir, { recursive: true, force: true });
    }

    const distDir = join(REPO_ROOT, "dist/public");
    if (existsSync(distDir)) {
      const distFiles = walkFiles(distDir, (n) =>
        n.endsWith(".js") || n.endsWith(".html") || n.endsWith(".css") || n.endsWith(".map"),
      );
      const distCurie = scanLines(distFiles, /curie/i);
      expect(distCurie, distCurie.join("\n")).toEqual([]);
      const distForeign: string[] = [];
      for (const file of distFiles) {
        for (const m of readFileSync(file, "utf8").matchAll(bizRe)) {
          if (m[0] !== BEP_WHOP_COMPANY_ID) {
            distForeign.push(`${relative(REPO_ROOT, file)}: ${m[0]}`);
          }
        }
      }
      expect(distForeign, distForeign.join("\n")).toEqual([]);
    }
  });

  it("N1: client/ only imports isWhopCheckoutUrl from shared URL allowlist (CL openWhopCheckout)", () => {
    const files = walkFiles(join(REPO_ROOT, "client/src"), SRC_PRED).filter(
      (f) => !/\.test\.(ts|tsx)$/.test(f),
    );
    const failures = scanLines(files, /@shared\/account\/url-allowlist|sanitizeExternalBillingUrl/, {
      allow: (file, line) => {
        const rel = relative(REPO_ROOT, file);
        // PR D N2: openWhopCheckout may import isWhopCheckoutUrl only.
        return (
          rel === "client/src/lib/account.ts" &&
          /isWhopCheckoutUrl/.test(line) &&
          !/sanitizeExternalBillingUrl/.test(line)
        );
      },
    });
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("DP-T-COACH1: no 100000 / $1,000 coach LTV threshold in coach module", () => {
    const coach = join(REPO_ROOT, "shared/account/foundations-coach.ts");
    const src = readFileSync(coach, "utf8");
    expect(src).not.toMatch(/100000|1000_00|\$1,000/);
    expect(src).not.toMatch(/total_ltv|ltv_cents/);
  });

  it("DP-T-CERT2: shared ltv.ts imported by worker and client account pages", () => {
    const worker = readFileSync(join(REPO_ROOT, "worker/account.ts"), "utf8");
    expect(worker).toMatch(/from ["'].*shared\/account\/ltv["']/);
    const clientFiles = walkFiles(join(REPO_ROOT, "client/src/pages/account"), SRC_PRED).filter(
      (f) => !/\.test\.(ts|tsx)$/.test(f),
    );
    const importsLtv = clientFiles.some((f) =>
      /from ["']@shared\/account\/ltv["']|from ["'].*shared\/account\/ltv["']/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(importsLtv).toBe(true);
  });

  it("DP-T-COACH5: never OR BSI foundations_coach badge", () => {
    const src = readFileSync(join(REPO_ROOT, "worker/account.ts"), "utf8");
    expect(src).not.toMatch(/badges\.foundations_coach\s*\|\|/);
    expect(src).not.toMatch(/foundations_coach\s*\|\|\s*badges/);
  });

  it("T11: zero cancel_med_subscription", () => {
    const files = walkFiles(REPO_ROOT, SRC_PRED).filter((f) => {
      const rel = relative(REPO_ROOT, f);
      return (
        !rel.startsWith("node_modules/") &&
        !rel.startsWith("dist/") &&
        !rel.includes("account.repo-scan.test.ts")
      );
    });
    const failures = scanLines(files, /cancel_med_subscription/);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("zero manus references in production worker/client/shared", () => {
    const files = ["client/src", "worker", "shared"]
      .flatMap((d) => walkFiles(join(REPO_ROOT, d), SRC_PRED))
      .filter((f) => !/\.test\.(ts|tsx)$/.test(relative(REPO_ROOT, f)));
    const failures = scanLines(files, /manus/i);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("T10: zero dangerouslySetInnerHTML in account/member pages when present", () => {
    const dirs = [
      join(REPO_ROOT, "client/src/pages/account"),
      join(REPO_ROOT, "client/src/pages/members"),
      join(REPO_ROOT, "client/src/pages/member"),
    ];
    const existing = dirs.filter((d) => existsSync(d));
    if (existing.length === 0) {
      expect(existing.length).toBe(0);
      return;
    }
    const files = existing
      .flatMap((d) => walkFiles(d, SRC_PRED))
      .filter((f) => !/\.test\.(ts|tsx)$/.test(relative(REPO_ROOT, f)));
    const failures = scanLines(files, /dangerouslySetInnerHTML|role_badges_html/);
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("Rule 4: zero test-only hooks in production worker/client/shared", () => {
    const files = ["client/src", "worker", "shared"]
      .flatMap((d) => walkFiles(join(REPO_ROOT, d), SRC_PRED))
      .filter((f) => {
        const rel = relative(REPO_ROOT, f);
        return !/\.test\.(ts|tsx)$/.test(rel) && !rel.includes("__fixtures__");
      });
    const patterns = [
      /__TEST__/,
      /process\.env\.VITEST/,
      /NODE_ENV\s*===\s*["']test["']/,
      /import\.meta\.env\.MODE\s*===\s*["']test["']/,
    ];
    const failures: string[] = [];
    for (const re of patterns) {
      failures.push(...scanLines(files, re));
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("T1: worker/account.ts never raw-fetches BSI without runUserBsiCall path helpers", () => {
    const file = join(REPO_ROOT, "worker/account.ts");
    expect(existsSync(file)).toBe(true);
    const src = readFileSync(file, "utf8");
    expect(src).toContain("runUserBsiCall");
    expect(src).toContain("bsiAccountBearerHeaders");
    expect(src).not.toMatch(/DAILY_FIX_API_KEY/);
    expect(src).not.toMatch(/bsiBearerHeaders\(/);
    expect(src).not.toMatch(/bsiGetHeaders\(/);
    expect(src).not.toMatch(/bsiJsonHeaders\(/);
  });

  it("DP-T-CFG1: wrangler prod account limiter ids 27112-27114", () => {
    const raw = readFileSync(join(REPO_ROOT, "wrangler.jsonc"), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    const byName = Object.fromEntries(
      (json.ratelimits as Array<{ name: string; namespace_id: string; simple: { limit: number; period: number } }>).map(
        (r) => [r.name, r],
      ),
    );
    expect(byName.ACCOUNT_READ_LIMITER).toMatchObject({
      namespace_id: "27112",
      simple: { limit: 60, period: 60 },
    });
    expect(byName.ACCOUNT_WRITE_LIMITER).toMatchObject({
      namespace_id: "27113",
      simple: { limit: 15, period: 60 },
    });
    expect(byName.ACCOUNT_PORTAL_LIMITER).toMatchObject({
      namespace_id: "27114",
      simple: { limit: 10, period: 60 },
    });
  });

  it("CL3: CL1=READ / CL2=WRITE limiter lockstep (top + previews)", () => {
    const raw = readFileSync(join(REPO_ROOT, "wrangler.jsonc"), "utf8");
    const json = JSON.parse(raw.replace(/\/\/.*$/gm, ""));
    const byName = Object.fromEntries(
      (json.ratelimits as Array<{ name: string; namespace_id: string; simple: { limit: number; period: number } }>).map(
        (r) => [r.name, r],
      ),
    );
    const prev = Object.fromEntries(
      (
        json.previews.ratelimits as Array<{
          name: string;
          namespace_id: string;
          simple: { limit: number; period: number };
        }>
      ).map((r) => [r.name, r]),
    );
    expect(prev.ACCOUNT_READ_LIMITER.namespace_id).toBe("27212");
    expect(prev.ACCOUNT_WRITE_LIMITER.namespace_id).toBe("27213");
    expect(prev.ACCOUNT_READ_LIMITER.simple).toEqual(byName.ACCOUNT_READ_LIMITER.simple);
    expect(prev.ACCOUNT_WRITE_LIMITER.simple).toEqual(byName.ACCOUNT_WRITE_LIMITER.simple);
    const accountSrc = readFileSync(join(REPO_ROOT, "worker/account.ts"), "utf8");
    expect(accountSrc).toMatch(/id:\s*"CL1"[\s\S]*?limiter:\s*"read"/);
    expect(accountSrc).toMatch(/id:\s*"CL2"[\s\S]*?limiter:\s*"write"/);
  });

  it("CI-CHECK-1: ci.yml runs npm run check as a required step", () => {
    const ci = readFileSync(join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
    expect(ci).toMatch(/^\s+run:\s*npm run check\s*$/m);
    expect(ci).not.toMatch(/npm run check[\s\S]{0,80}continue-on-error:\s*true/);
  });

  it("CL-T21 / CL-MONEY-SCAN-1: no *_cents / 100 outside formatUsdFromCents (1.2.12 frozen)", () => {
    // FROZEN (1.2.12): patterns A|B unchanged from 1.2.11.
    const { hitsMoney } = moneyScanMatchers();

    // Exactly 24 fixtures (12 gating + 12 non-gating), frozen; plus N35/N33 extras.
    const gatingFixtures = [
      "x_cents / 100",
      "(price_cents) / 100",
      "(a_cents+b_cents)/100",
      "Math.trunc(x_cents)/100",
      "Math.floor(course.course_price_cents / 100)",
      "(price_cents - fee)/100",
      "(price_cents * qty)/100",
      "(price_cents - bps)/100",
      "(price_cents - commission_bps)/100",
      "(price_cents + fee_bps)/100",
      "(price_cents /* bps */)/100",
      "foo(price_cents, rate)/100",
    ];
    const nongatingFixtures = [
      "commission_bps / 100",
      "x_cents * commission_bps / 100",
      "price_cents - commission_bps / 100",
      "x_cents / 100.5",
      "x_cents * 2 / 100",
      "(x_cents * commission_bps) / 100",
      "(commission_bps * x_cents)/100",
      "commission_bps * x_cents / 100",
      "commission_bps*x_cents/100",
      "((price_cents - fee))/100",
      "(Math.round(price_cents) * 2)/100",
      "(x_cents) / 1000",
    ];
    expect(gatingFixtures).toHaveLength(12);
    expect(nongatingFixtures).toHaveLength(12);
    for (const s of gatingFixtures) {
      expect(hitsMoney(s), `gating miss: ${s}`).toBe(true);
    }
    for (const s of nongatingFixtures) {
      expect(hitsMoney(s), `nongating hit: ${s}`).toBe(false);
    }
    expect(hitsMoney("commission_bps*(x_cents)/100")).toBe(true);
    expect(hitsMoney("(price_cents - fee) * bps / 100")).toBe(false);

    // errata d3 DR-3: scrub only the formatUsdFromCents *name*; args stay scanned.
    // formatUsdFromCents(price_cents / 100) must FAIL (args still hit).
    expect(hitsMoney(scrubFormatUsdName('formatUsdFromCents(price_cents / 100)'))).toBe(true);
    expect(hitsMoney(scrubFormatUsdName('formatUsdFromCents(x)'))).toBe(false);
    // errata d3 DR-2 / S-R4-2: long line with a real hit gates (+ LONGLINE warn).
    const plantedLong = `${"x".repeat(380)} price_cents / 100 ${"y".repeat(40)}`;
    expect(plantedLong.length).toBeGreaterThan(400);
    expect(hitsMoney(scrubFormatUsdName(plantedLong))).toBe(true);

    const dirs = [
      join(REPO_ROOT, "client/src/pages/account"),
      join(REPO_ROOT, "shared/account"),
      join(REPO_ROOT, "client/src/lib"),
    ];
    const files = dirs
      .flatMap((d) => walkFiles(d, SRC_PRED))
      .filter((f) => {
        const rel = relative(REPO_ROOT, f);
        if (/\.test\.(ts|tsx)$/.test(rel)) return false;
        if (rel.endsWith("LtvVisualizer.tsx")) return false;
        if (rel.includes("daily-fix")) return false;
        return true;
      });

    const { gatingHits } = runMoneyScanOnFiles(files, { emit: true, root: REPO_ROOT });
    expect(gatingHits, gatingHits.join("\n")).toEqual([]);

    const toFixedHits = scanLines(files, /\.toFixed\s*\(/, {
      allow: (file) => relative(REPO_ROOT, file).endsWith("shared/account/ltv.ts"),
    });
    expect(toFixedHits, toFixedHits.join("\n")).toEqual([]);

    const intlPatterns = [
      /\bIntl\s*\.\s*NumberFormat\b/,
      /\bNumberFormat\s*\(/,
      /=\s*Intl\b/,
      /\{[^}]*\bNumberFormat\b[^}]*\}\s*=\s*Intl\b/,
    ];
    for (const re of intlPatterns) {
      const hits = scanLines(files, re, {
        allow: (file) => relative(REPO_ROOT, file).endsWith("shared/account/ltv.ts"),
      });
      expect(hits, hits.join("\n")).toEqual([]);
    }

    const localeHits = scanLines(files, /\.toLocaleString\(\s*[^,)]+,/, {
      allow: (file) => relative(REPO_ROOT, file).endsWith("shared/account/ltv.ts"),
    });
    expect(localeHits, localeHits.join("\n")).toEqual([]);

    const defRe = /(?:export\s+)?function\s+formatUsdFromCents\b/;
    const defs = scanLines(
      walkFiles(join(REPO_ROOT, "shared"), SRC_PRED).filter(
        (f) => !/\.test\.(ts|tsx)$/.test(relative(REPO_ROOT, f)),
      ),
      defRe,
    );
    expect(defs).toHaveLength(1);
  });

  it("CL-SCAN-REVIEW-1: real scanner on planted temp files (400 vs 401, summary, clean exit)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plantDir = mkdtempSync(join(tmpdir(), "money-scan-plant-"));
    const summaryPath = join(plantDir, "summary.md");
    writeFileSync(summaryPath, "");
    const prev = process.env.GITHUB_STEP_SUMMARY;
    process.env.GITHUB_STEP_SUMMARY = summaryPath;
    try {
      // 401-char real hit → LONGLINE + gating.
      const longHit = `${"z".repeat(380)} price_cents / 100 ${"w".repeat(40)}`;
      expect(longHit.length).toBeGreaterThan(400);
      // 400-char real hit → gating only (not LONGLINE).
      const hit = "price_cents / 100";
      const exactly400 = `${"a".repeat(400 - hit.length)}${hit}`;
      expect(exactly400.length).toBe(400);
      // Clean long line (no money hit) → exit 0, 0 LONGLINE.
      const cleanLong = `${"c".repeat(420)} // no cents div`;
      expect(cleanLong.length).toBeGreaterThan(400);
      const advisory = "x_cents * commission_bps / 100";

      const longFile = join(plantDir, "long-hit.ts");
      const shortFile = join(plantDir, "exact-400.ts");
      const cleanFile = join(plantDir, "clean-long.ts");
      const advFile = join(plantDir, "advisory.ts");
      writeFileSync(longFile, `${longHit}\n`);
      writeFileSync(shortFile, `${exactly400}\n`);
      writeFileSync(cleanFile, `${cleanLong}\n`);
      writeFileSync(advFile, `${advisory}\n`);

      const result = runMoneyScanOnFiles(
        [longFile, shortFile, cleanFile, advFile],
        { emit: true, root: plantDir },
      );

      expect(result.gatingHits.some((h) => h.includes("long-hit.ts:1:"))).toBe(true);
      expect(result.gatingHits.some((h) => h.includes("exact-400.ts:1:"))).toBe(true);
      expect(result.longLineReview).toHaveLength(1);
      expect(result.longLineReview[0]).toContain("long-hit.ts:1:");
      expect(result.advisoryHits).toHaveLength(1);
      expect(result.advisoryHits[0]).toContain("advisory.ts:1:");
      // Clean long line alone does not fail / does not LONGLINE.
      expect(result.longLineReview.every((h) => !h.includes("clean-long.ts"))).toBe(true);
      expect(result.gatingHits.every((h) => !h.includes("clean-long.ts"))).toBe(true);

      const warns = warn.mock.calls.map((c) => String(c[0]));
      expect(warns.filter((w) => w.startsWith("MONEY-SCAN-LONGLINE:"))).toHaveLength(1);
      expect(warns.filter((w) => w.startsWith("MONEY-SCAN-ADVISORY:"))).toHaveLength(1);
      const summary = readFileSync(summaryPath, "utf8");
      const entryLines = summary.split("\n").filter((l) => l.startsWith("- `"));
      expect(entryLines).toHaveLength(2);
      expect(entryLines[0]).toContain("long-hit.ts:1:");
      expect(entryLines[1]).toContain("advisory.ts:1:");
    } finally {
      warn.mockRestore();
      if (prev === undefined) delete process.env.GITHUB_STEP_SUMMARY;
      else process.env.GITHUB_STEP_SUMMARY = prev;
      rmSync(plantDir, { recursive: true, force: true });
    }
  });

  it("CQ B1: no claimCertificate / method: 'ltv' in production sources", () => {
    const files = ["client/src", "worker", "shared"]
      .flatMap((d) => walkFiles(join(REPO_ROOT, d), SRC_PRED))
      .filter((f) => !/\.test\.(ts|tsx)$/.test(relative(REPO_ROOT, f)));
    const claimHits = scanLines(files, /\bclaimCertificate\b/);
    expect(claimHits, claimHits.join("\n")).toEqual([]);
    const methodHits = scanLines(files, /method\s*:\s*['"]ltv['"]/);
    expect(methodHits, methodHits.join("\n")).toEqual([]);
  });

  it("item 12: exactly one sanitizeReturnPath implementation + lib re-export", () => {
    const implRe =
      /(export\s+)?(async\s+)?function\s+sanitizeReturnPath\b|\b(const|let|var)\s+sanitizeReturnPath\s*=/;
    const files = ["client/src", "worker", "shared"]
      .flatMap((d) => walkFiles(join(REPO_ROOT, d), SRC_PRED))
      .filter((f) => !/\.test\.(ts|tsx)$/.test(relative(REPO_ROOT, f)));
    const implHits = scanLines(files, implRe);
    expect(implHits).toHaveLength(1);
    expect(implHits[0]).toContain("shared/account/returnPath.ts");

    const lib = readFileSync(join(REPO_ROOT, "client/src/lib/account.ts"), "utf8");
    expect(lib).toMatch(
      /export\s*\{\s*sanitizeReturnPath\s*\}\s*from\s*['"][^'"]*shared\/account\/returnPath['"]/,
    );
  });
});
