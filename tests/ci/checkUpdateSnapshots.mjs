#!/usr/bin/env node
/**
 * T-F-68 / T-E-43 — errata e3 ER-12 > e2 ER-10 > e1 ER-3.
 * Full-command -u scan for Playwright-related steps/scripts; one-level wrapper
 * expansion; npm/pnpm/yarn `--` (and yarn bare) forwarding.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** True if the full command string contains a snapshot-update flag token. */
export function fullCommandHasUpdateFlag(cmd) {
  const re =
    /(?:^|[\s;|&()`])(?:-[uU](?:=[^\s;|&]*)?|--update-snapshots(?:=[^\s;|&]*)?)(?=["'\s;|&`]|$)/;
  return re.test(` ${cmd} `) || /(?:^|[\s;|&])-[uU]["']/.test(cmd);
}

export function splitSegments(cmd) {
  const segments = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      cur += c;
      if (c === quote && cmd[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    const two = cmd.slice(i, i + 2);
    if (two === "&&" || two === "||") {
      segments.push(cur.trim());
      cur = "";
      i++;
      continue;
    }
    if (c === ";" || c === "|") {
      segments.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim()) segments.push(cur.trim());
  return segments.filter(Boolean);
}

/**
 * Resolve a package-manager script invocation to { name, forwardedArgs }.
 * Covers: npm run, npm run-script, pnpm run, pnpm <name>, yarn run, yarn <name>.
 */
export function parseScriptInvocation(seg) {
  let m = seg.match(
    /\b(?:npm\s+run(?:-script)?|pnpm\s+run|yarn\s+run)\s+([\w:.-]+)(.*)$/,
  );
  if (m) {
    return { name: m[1], rest: m[2] || "" };
  }
  // pnpm <script> / yarn <script> (no "run"), but not pnpm exec/dlx/install/…
  m = seg.match(/\b(?:pnpm|yarn)\s+([\w:.-]+)(.*)$/);
  if (m) {
    const reserved = new Set([
      "run",
      "exec",
      "dlx",
      "install",
      "add",
      "remove",
      "why",
      "list",
      "outdated",
      "audit",
      "publish",
      "init",
      "create",
      "config",
      "help",
      "playwright", // yarn playwright … is binary, not a script name
    ]);
    if (!reserved.has(m[1])) {
      return { name: m[1], rest: m[2] || "" };
    }
  }
  return null;
}

function forwardedArgs(rest) {
  const dd = rest.match(/\s--\s+(.*)$/);
  if (dd) return dd[1];
  // yarn may forward without --: `yarn test:visual -u`
  const bare = rest.match(/^\s+(.+)$/);
  return bare ? bare[1] : "";
}

function mentionsPlaywright(cmd) {
  return (
    /\bplaywright\b/.test(cmd) ||
    /\b(?:npx|pnpm(?:\s+exec|\s+dlx)?|yarn(?:\s+dlx|\s+run)?|npm\s+exec)\b[^\n]*\bplaywright\b/.test(
      cmd,
    )
  );
}

export function collectPlaywrightScriptSet(scripts) {
  const set = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, body] of Object.entries(scripts)) {
      if (set.has(name)) continue;
      if (/\bplaywright\s+test\b/.test(body) || /\bplaywright\b/.test(body)) {
        set.add(name);
        changed = true;
        continue;
      }
      for (const seg of splitSegments(body)) {
        const inv = parseScriptInvocation(seg);
        if (inv && set.has(inv.name)) {
          set.add(name);
          changed = true;
        }
      }
    }
  }
  return set;
}

/**
 * ER-12: one-level expansion — if body is `npm/pnpm/yarn … <name> [--] args`,
 * return `scripts[name] + " " + args` for scanning.
 */
export function expandOneLevel(cmd, scripts) {
  const parts = [];
  for (const seg of splitSegments(cmd)) {
    const inv = parseScriptInvocation(seg);
    if (inv && scripts[inv.name]) {
      const fwd = forwardedArgs(inv.rest);
      parts.push(`${scripts[inv.name]}${fwd ? ` ${fwd}` : ""}`);
    } else {
      parts.push(seg);
    }
  }
  return parts.join(" ; ");
}

/** ER-10/12: Playwright-related → scan full string + one-level expansion. */
export function commandViolates(cmd, scriptSet, scripts = {}) {
  const related =
    mentionsPlaywright(cmd) ||
    splitSegments(cmd).some((seg) => {
      const inv = parseScriptInvocation(seg);
      return inv && scriptSet.has(inv.name);
    });
  if (!related) return false;
  if (fullCommandHasUpdateFlag(cmd)) return true;
  // ER-12 one-level expand
  const expanded = expandOneLevel(cmd, scripts);
  if (expanded !== cmd && fullCommandHasUpdateFlag(expanded)) return true;
  return false;
}

function listWorkflowFiles() {
  const dir = path.join(root, ".github/workflows");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => /\.ya?ml$/i.test(n))
    .map((n) => path.join(dir, n));
}

function workflowRunCommands(text) {
  const lines = text.split(/\r?\n/);
  const cmds = [];
  let inRun = false;
  let buf = [];
  const flush = () => {
    if (buf.length) cmds.push(buf.join("\n"));
    buf = [];
  };
  for (const line of lines) {
    const runInline = line.match(/^\s*(?:-\s*)?run:\s*(.+)$/);
    if (runInline && !/^[\|>]/.test(runInline[1].trim())) {
      flush();
      inRun = false;
      cmds.push(runInline[1]);
      continue;
    }
    if (/^\s*(?:-\s*)?run:\s*[\|>]?\s*$/.test(line)) {
      flush();
      inRun = true;
      continue;
    }
    if (inRun) {
      if (/^\s{0,2}\S/.test(line) && !/^\s{4,}/.test(line) && line.trim() !== "") {
        flush();
        inRun = false;
      } else {
        buf.push(line.replace(/^\s{4}/, ""));
      }
    }
  }
  flush();
  return cmds;
}

export function checkRepo({
  pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")),
  workflowTexts,
} = {}) {
  const errors = [];
  const scripts = pkg.scripts || {};
  const scriptSet = collectPlaywrightScriptSet(scripts);

  for (const name of scriptSet) {
    const body = scripts[name];
    // Direct flags, or one-level expansion (ER-12 wrapper)
    if (
      fullCommandHasUpdateFlag(body) ||
      fullCommandHasUpdateFlag(expandOneLevel(body, scripts))
    ) {
      errors.push(`package.json scripts["${name}"] allows snapshot update: ${body}`);
    }
  }

  const files = workflowTexts
    ? Object.entries(workflowTexts).map(([fp, text]) => ({ fp, text }))
    : listWorkflowFiles().map((fp) => ({ fp, text: fs.readFileSync(fp, "utf8") }));

  for (const { fp, text } of files) {
    for (const cmd of workflowRunCommands(text)) {
      if (commandViolates(cmd, scriptSet, scripts)) {
        errors.push(
          `${fp}: Playwright command allows snapshot update: ${cmd.trim().slice(0, 160)}`,
        );
      }
    }
  }
  return errors;
}

function selfTest() {
  const scripts = {
    "test:visual": "playwright test",
    test: "vitest run",
    vis: "playwright test",
    pw: "playwright test",
  };
  const set = collectPlaywrightScriptSet({
    ...scripts,
    upd: "npm run test:visual -- -u",
  });
  if (!set.has("upd")) {
    throw new Error("self-test: wrapper upd must join playwright set");
  }

  const mustFail = [
    "npx playwright test -u",
    'playwright test -u"',
    "playwright test -u=all",
    "playwright test --update-snapshots",
    "playwright test --update-snapshots=all",
    "npm run test:visual -- -u",
    "npm test; npx playwright test -u",
    "pnpm exec playwright test --update-snapshots",
    "yarn playwright test -u",
    // ER-12
    "pnpm test:visual -- -u",
    "pnpm run test:visual -- --update-snapshots",
    "yarn test:visual -u",
    "yarn run test:visual --update-snapshots",
  ];
  for (const c of mustFail) {
    if (!commandViolates(c, set, scripts)) {
      throw new Error(`self-test: expected fail for: ${c}`);
    }
  }

  // ER-12 wrapper script fixture
  const wrapper = checkRepo({
    pkg: {
      scripts: {
        "test:visual": "playwright test",
        upd: "npm run test:visual -- -u",
        test: "vitest run",
      },
    },
    workflowTexts: { "ci.yml": "        run: npm test\n" },
  });
  if (!wrapper.some((e) => e.includes('scripts["upd"]'))) {
    throw new Error(`self-test: ER-12 upd wrapper not caught: ${wrapper.join(" | ")}`);
  }

  if (commandViolates("diff -u a b", set, scripts)) {
    throw new Error("self-test: bare diff -u should pass");
  }

  const stagingPkg = {
    scripts: {
      test: "vitest run",
      "test:visual": "playwright test",
      "test:a11y": "playwright test --project=a11y",
      lint: "diff -u a b",
    },
  };
  const stagingSet = collectPlaywrightScriptSet(stagingPkg.scripts);
  if (stagingSet.has("test")) {
    throw new Error("self-test: vitest 'test' must not enter playwright set");
  }
  if (commandViolates("before=$(x); npm test; after=$(y); diff -u a b", stagingSet, stagingPkg.scripts)) {
    throw new Error("self-test: staging unit diff -u should pass");
  }
  if (!commandViolates("playwright test && diff -u a b", stagingSet, stagingPkg.scripts)) {
    throw new Error("self-test: playwright && diff -u must fail under ER-10");
  }

  const planted = checkRepo({
    pkg: {
      scripts: {
        vis: "playwright test -u",
        "test:visual": "playwright test",
        upd: "npm run test:visual -- -u",
        test: "vitest run",
      },
    },
    workflowTexts: {
      "ci.yml": [
        "        run: npx playwright test -u",
        "        run: npm test; npx playwright test -u",
        "        run: before=x; npm test; diff -u a b",
        "        run: pnpm exec playwright test --update-snapshots",
        "        run: yarn playwright test -u",
        "        run: pnpm test:visual -- -u",
        "        run: yarn test:visual -u",
      ].join("\n"),
    },
  });
  if (!planted.some((e) => e.includes('scripts["vis"]'))) {
    throw new Error(`self-test: vis -u not caught: ${planted.join(" | ")}`);
  }
  if (!planted.some((e) => e.includes('scripts["upd"]'))) {
    throw new Error(`self-test: upd wrapper not caught: ${planted.join(" | ")}`);
  }
  if (!planted.some((e) => /pnpm test:visual -- -u/.test(e))) {
    throw new Error(`self-test: pnpm forwarding not caught: ${planted.join(" | ")}`);
  }
  if (!planted.some((e) => /yarn test:visual -u/.test(e))) {
    throw new Error(`self-test: yarn forwarding not caught: ${planted.join(" | ")}`);
  }

  console.log("checkUpdateSnapshots self-test ok (ER-12)");
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    selfTest();
    process.exit(0);
  }
  const errors = checkRepo();
  if (errors.length) {
    console.error("T-F-68 / updateSnapshots check failed:");
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }
  console.log("T-F-68 ok: no Playwright snapshot-update flags");
}
