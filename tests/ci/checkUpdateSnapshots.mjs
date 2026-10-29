#!/usr/bin/env node
/**
 * T-F-68 / T-E-43 — errata e4 ER-13 > e3 ER-12 > e2 ER-10 > e1 ER-3.
 * Per-segment -u gate only on snapshot-capable runners (playwright|vitest|jest),
 * including one-level package.json wrapper expansion (ER-12).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const RUNNER_RE = /\b(?:playwright|vitest|jest)\b/;

/** True if the string contains a snapshot-update flag token. */
export function fullCommandHasUpdateFlag(cmd) {
  const re =
    /(?:^|[\s;|&()`])(?:-[uU](?:=[^\s;|&]*)?|--update-snapshots(?:=[^\s;|&]*)?)(?=["'\s;|&`]|$)/;
  return re.test(` ${cmd} `) || /(?:^|[\s;|&])-[uU]["']/.test(cmd);
}

export function splitSegments(cmd) {
  const segments = [];
  let cur = "";
  let quote = null;
  let depth = 0; // ( subshells
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
    if (c === "(") {
      depth++;
      cur += c;
      continue;
    }
    if (c === ")" && depth > 0) {
      depth--;
      cur += c;
      continue;
    }
    if (depth > 0) {
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

export function parseScriptInvocation(seg) {
  let m = seg.match(
    /\b(?:npm\s+run(?:-script)?|pnpm\s+run|yarn\s+run)\s+([\w:.-]+)(.*)$/,
  );
  if (m) return { name: m[1], rest: m[2] || "" };
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
      "playwright",
    ]);
    if (!reserved.has(m[1])) return { name: m[1], rest: m[2] || "" };
  }
  return null;
}

function forwardedArgs(rest) {
  const dd = rest.match(/\s--\s+(.*)$/);
  if (dd) return dd[1];
  const bare = rest.match(/^\s+(.+)$/);
  return bare ? bare[1] : "";
}

export function collectPlaywrightScriptSet(scripts) {
  // Keep name for back-compat; now means snapshot-runner script set.
  const set = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, body] of Object.entries(scripts)) {
      if (set.has(name)) continue;
      if (RUNNER_RE.test(body)) {
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

/** One-level expand of package-manager script invocations inside a segment. */
export function expandSegmentOneLevel(seg, scripts) {
  const inv = parseScriptInvocation(seg);
  if (inv && scripts[inv.name]) {
    const fwd = forwardedArgs(inv.rest);
    return `${scripts[inv.name]}${fwd ? ` ${fwd}` : ""}`;
  }
  return seg;
}

/** ER-13: segment invokes a snapshot-capable runner (direct or via one-level wrapper). */
export function segmentInvokesRunner(seg, scripts = {}, scriptSet = new Set()) {
  const expanded = expandSegmentOneLevel(seg, scripts);
  if (RUNNER_RE.test(expanded) || RUNNER_RE.test(seg)) return true;
  const inv = parseScriptInvocation(seg);
  if (inv && scriptSet.has(inv.name)) return true;
  // npx/pnpm exec/yarn dlx playwright|vitest|jest
  if (
    /\b(?:npx|pnpm\s+exec|pnpm\s+dlx|yarn\s+dlx|npm\s+exec)\s+(?:playwright|vitest|jest)\b/.test(
      seg,
    )
  ) {
    return true;
  }
  return false;
}

/** ER-13: only runner segments are checked for -u flags. */
export function segmentViolates(seg, scripts = {}, scriptSet = new Set()) {
  if (!segmentInvokesRunner(seg, scripts, scriptSet)) return false;
  if (fullCommandHasUpdateFlag(seg)) return true;
  const expanded = expandSegmentOneLevel(seg, scripts);
  return expanded !== seg && fullCommandHasUpdateFlag(expanded);
}

export function commandViolates(cmd, scriptSet, scripts = {}) {
  return splitSegments(cmd).some((seg) => segmentViolates(seg, scripts, scriptSet));
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
    if (commandViolates(body, scriptSet, scripts)) {
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
          `${fp}: snapshot-runner segment allows update: ${cmd.trim().slice(0, 160)}`,
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
  if (!set.has("upd")) throw new Error("self-test: upd must join runner set");
  // vitest "test" is also a runner script under ER-13
  if (!set.has("test")) throw new Error("self-test: vitest test script must join set");

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
    "pnpm test:visual -- -u",
    "pnpm run test:visual -- --update-snapshots",
    "yarn test:visual -u",
    "yarn run test:visual --update-snapshots",
    // ER-13 required
    "diff -u a b && npx vitest -u",
    "jest --update-snapshots",
  ];
  for (const c of mustFail) {
    if (!commandViolates(c, set, scripts)) {
      throw new Error(`self-test: expected fail for: ${c}`);
    }
  }

  const mustPass = [
    "diff -u a b",
    "git diff -u",
    "patch -u",
    "diff -u a b; npx playwright test", // ER-13: diff segment ignored; playwright has no -u
    "before=$(x); npm test; after=$(y); diff -u a b", // vitest npm test has no -u; diff ignored
    "playwright test && diff -u a b", // playwright no -u; diff ignored
  ];
  for (const c of mustPass) {
    if (commandViolates(c, set, scripts)) {
      throw new Error(`self-test: expected pass for: ${c}`);
    }
  }

  const wrapper = checkRepo({
    pkg: {
      scripts: {
        "test:visual": "playwright test",
        upd: "npm run test:visual -- -u",
        test: "vitest run",
      },
    },
    workflowTexts: {
      "ci.yml": [
        "        run: diff -u a b; npx playwright test",
        "        run: before=x; npm test; diff -u a b",
        "        run: diff -u a b && npx vitest -u",
        "        run: jest --update-snapshots",
      ].join("\n"),
    },
  });
  if (!wrapper.some((e) => e.includes('scripts["upd"]'))) {
    throw new Error(`self-test: upd not caught: ${wrapper.join(" | ")}`);
  }
  if (!wrapper.some((e) => /vitest -u/.test(e))) {
    throw new Error(`self-test: vitest -u not caught: ${wrapper.join(" | ")}`);
  }
  if (!wrapper.some((e) => /jest --update-snapshots/.test(e))) {
    throw new Error(`self-test: jest not caught: ${wrapper.join(" | ")}`);
  }
  if (wrapper.some((e) => /diff -u a b; npx playwright test/.test(e))) {
    throw new Error(`self-test: ER-13 pass fixture falsely failed: ${wrapper.join(" | ")}`);
  }

  console.log("checkUpdateSnapshots self-test ok (ER-13)");
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
