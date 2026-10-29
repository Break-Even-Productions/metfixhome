#!/usr/bin/env node
/**
 * Advisory targeted mutants (QA r1.3). Gating 0.
 * Each mutant: apply patch → run named vitest files → revert → record kill/survive.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const mutants = [
  {
    id: "LM3",
    file: "client/src/pages/search/searchState.ts",
    find: 'const noun = opts.n === 1 ? "resource" : "resources";',
    replace: 'const noun = "resources";',
    red: ["client/src/pages/search/searchState.test.ts"],
  },
  {
    id: "LM4",
    file: "shared/library/searchTopics.ts",
    find: '{ slug: "webinars", label: "Live Streams" },',
    replace: '{ slug: "videos", label: "Live Streams" },',
    red: ["client/src/pages/search/searchState.test.ts", "client/src/pages/search/SearchPage.mount.test.tsx"],
  },
  {
    id: "LM24",
    file: "shared/library/searchTopics.ts",
    find: "if (seen.has(row.topic_id)) continue;\n    seen.add(row.topic_id);",
    replace: "seen.add(row.topic_id);",
    red: ["shared/library/searchTopics.test.ts"],
  },
  {
    id: "LM25",
    file: "shared/library/searchTopics.ts",
    find: "return [...fromSanity, ...fromApi];",
    replace: "return [...fromApi, ...fromSanity];",
    // actual code builds into `out` — see patch below
    red: ["shared/library/searchTopics.test.ts"],
  },
  {
    id: "LM27",
    file: "shared/library/searchTopics.ts",
    find: "return out;",
    replace:
      'return out.length ? out : [{ topicId: 1, label: "Metabolic Health" }];',
    red: ["shared/library/searchTopics.test.ts"],
  },
  {
    id: "LM28",
    file: "client/src/pages/search/searchState.ts",
    find: "export function selectTopicTab(prev: SearchUrlState, topicId: number): SearchUrlState {\n  return { ...prev, topic: topicId };\n}",
    replace:
      "export function selectTopicTab(prev: SearchUrlState, topicId: number): SearchUrlState {\n  return { ...prev, topic: topicId, type: null };\n}",
    red: ["client/src/pages/search/searchState.test.ts"],
  },
];

const results = [];

for (const m of mutants) {
  const abs = path.join(root, m.file);
  const original = fs.readFileSync(abs, "utf8");
  if (!original.includes(m.find)) {
    // LM25 special-case: reverse return order via out construction
    if (m.id === "LM25") {
      const altFind = "return out;";
      const altReplace =
        "return [...out].sort((a, b) => {/* api-first sabotage */} 0); // noop keep for detect\n  // sabotage: put later-api-looking order by reversing sanity-first\n  const sanityCount = (arguments[0] ?? []).length;\n  void sanityCount;\n  return out;";
      results.push({ id: m.id, status: "skip-no-anchor", note: "use LM25b" });
      continue;
    }
    results.push({ id: m.id, status: "skip-no-anchor" });
    continue;
  }
  fs.writeFileSync(abs, original.replace(m.find, m.replace));
  let killed = false;
  let err = "";
  try {
    execSync(`npx vitest run ${m.red.join(" ")} --reporter=dot`, {
      cwd: root,
      stdio: "pipe",
      encoding: "utf8",
    });
  } catch (e) {
    killed = true;
    err = String(e.stderr || e.stdout || e.message).slice(0, 200);
  }
  fs.writeFileSync(abs, original);
  results.push({ id: m.id, status: killed ? "killed" : "SURVIVED", err });
}

// LM25: reverse merge order
{
  const abs = path.join(root, "shared/library/searchTopics.ts");
  const original = fs.readFileSync(abs, "utf8");
  const find = `  for (const t of apiTopics ?? []) {
    if (!t || !positiveInt(t.id)) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const label =
      typeof t.name === "string" && t.name.trim()
        ? t.name.trim()
        : typeof t.slug === "string" && t.slug.trim()
          ? t.slug.trim()
          : \`Topic \${t.id}\`;
    out.push({ topicId: t.id, label });
  }

  return out;`;
  const replace = `  const apiOnly = [];
  for (const t of apiTopics ?? []) {
    if (!t || !positiveInt(t.id)) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    const label =
      typeof t.name === "string" && t.name.trim()
        ? t.name.trim()
        : typeof t.slug === "string" && t.slug.trim()
          ? t.slug.trim()
          : \`Topic \${t.id}\`;
    apiOnly.push({ topicId: t.id, label });
  }

  return [...apiOnly, ...out];`;
  if (original.includes(find)) {
    fs.writeFileSync(abs, original.replace(find, replace));
    let killed = false;
    try {
      execSync(`npx vitest run shared/library/searchTopics.test.ts --reporter=dot`, {
        cwd: root,
        stdio: "pipe",
        encoding: "utf8",
      });
    } catch {
      killed = true;
    }
    fs.writeFileSync(abs, original);
    results.push({ id: "LM25", status: killed ? "killed" : "SURVIVED" });
  }
}

console.log(JSON.stringify(results, null, 2));
const survived = results.filter((r) => r.status === "SURVIVED");
process.exit(survived.length ? 0 : 0); // advisory — never gate
